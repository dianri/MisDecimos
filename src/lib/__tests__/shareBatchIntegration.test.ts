import test, { after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Evitar que el MessagePort del Scheduler de React bloquee el cierre del event loop en Node
const NativeMessageChannel = globalThis.MessageChannel
if (NativeMessageChannel) {
  globalThis.MessageChannel = class UnreffedMessageChannel extends NativeMessageChannel {
    constructor() {
      super()
      ;(this.port1 as unknown as { unref?: () => void }).unref?.()
      ;(this.port2 as unknown as { unref?: () => void }).unref?.()
    }
  } as typeof MessageChannel
}

// Configurar entorno DOM global antes de cargar @testing-library/react
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://misdecimos.dianrie.com/billetes/ticket-1',
})

const prevWindow = (globalThis as Record<string, unknown>).window
const prevDocument = (globalThis as Record<string, unknown>).document
const prevHTMLElement = (globalThis as Record<string, unknown>).HTMLElement

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
})

Object.defineProperty(globalThis, 'navigator', {
  value: {
    userAgent: 'node-test',
    clipboard: {
      writeText: async () => {},
    },
  },
  configurable: true,
})

dom.window.open = () => null

let rtlCleanup: (() => void) | null = null

afterEach(() => {
  rtlCleanup?.()
})

after(async () => {
  rtlCleanup?.()
  dom.window.close()
  if (prevWindow === undefined) delete (globalThis as Record<string, unknown>).window
  else (globalThis as Record<string, unknown>).window = prevWindow
  if (prevDocument === undefined) delete (globalThis as Record<string, unknown>).document
  else (globalThis as Record<string, unknown>).document = prevDocument
  if (prevHTMLElement === undefined) delete (globalThis as Record<string, unknown>).HTMLElement
  else (globalThis as Record<string, unknown>).HTMLElement = prevHTMLElement
})

test('Integración UI (@testing-library/react): crear 1 o múltiples participaciones abre ShareInviteModal automáticamente y avanza por lote', async () => {
  const cacheRoot = resolve(process.cwd(), 'node_modules/.cache')
  mkdirSync(cacheRoot, { recursive: true })
  const tempDir = mkdtempSync(resolve(cacheRoot, 'misdecimos-rtl-'))
  const outFile = resolve(tempDir, 'bundle.mjs')

  const buildScript = resolve(tempDir, 'build-bundle.mjs')
  writeFileSync(
    buildScript,
    `
    import { build, stop } from 'esbuild'
    await build({
      stdin: {
        contents: \`
          import React, { useState } from 'react'
          import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
          import { OwnershipBreakdownCard } from ${JSON.stringify(resolve(process.cwd(), 'src/components/tickets/OwnershipBreakdownCard.tsx'))}
          import { ShareInviteModal } from ${JSON.stringify(resolve(process.cwd(), 'src/components/tickets/ShareInviteModal.tsx'))}

          export { React, useState, render, screen, fireEvent, waitFor, cleanup, OwnershipBreakdownCard, ShareInviteModal }
        \`,
        resolveDir: ${JSON.stringify(process.cwd())},
        loader: 'tsx',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: ${JSON.stringify(outFile)},
      external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@testing-library/react'],
      plugins: [
        {
          name: 'mock-supabase-and-auth',
          setup(b) {
            b.onResolve({ filter: /(^|\\/)supabase(\\.ts)?$/ }, () => ({
              path: 'mock-supabase',
              namespace: 'mock-ns',
            }))
            b.onResolve({ filter: /\\/context\\/AuthContext$/ }, () => ({
              path: 'mock-auth',
              namespace: 'mock-ns',
            }))
            b.onLoad({ filter: /^mock-supabase$/, namespace: 'mock-ns' }, () => ({
              contents: \`
                let currentMode = 'batch2';
                export const supabase = {
                  rpc: async (fn, args) => {
                    if (fn === 'create_manual_participation') {
                      return { data: 'inv-manual-1', error: null };
                    }
                    if (fn === 'create_equal_split_participations') {
                      if (args.p_parts_count === 2) {
                        currentMode = 'single';
                        return { data: [{ invite_id: 'inv-p2', short_code: '493072', percentage: 50 }], error: null };
                      }
                      currentMode = 'batch2';
                      return {
                        data: [
                          { invite_id: 'inv-p2', short_code: '111111', percentage: 33.33 },
                          { invite_id: 'inv-p3', short_code: '222222', percentage: 33.33 },
                        ],
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                  from: () => ({
                    select: () => ({
                      eq: () => ({
                        single: async () => ({
                          data: {
                            id: 'inv-manual-1',
                            short_code: '888888',
                            invite_token: 'tok-manual-1',
                            percentage: 20,
                            label: 'Amigo',
                          },
                          error: null,
                        }),
                        eq: () => ({
                          order: async () => ({
                            data:
                              currentMode === 'single'
                                ? [
                                    {
                                      id: 'inv-p2',
                                      short_code: '493072',
                                      invite_token: 'tok-p2',
                                      percentage: 50,
                                      label: 'Parte 2',
                                    },
                                  ]
                                : [
                                    {
                                      id: 'inv-p2',
                                      short_code: '111111',
                                      invite_token: 'tok-p2',
                                      percentage: 33.33,
                                      label: 'Parte 2',
                                    },
                                    {
                                      id: 'inv-p3',
                                      short_code: '222222',
                                      invite_token: 'tok-p3',
                                      percentage: 33.33,
                                      label: 'Parte 3',
                                    },
                                  ],
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                };
              \`,
              loader: 'js',
            }))
            b.onLoad({ filter: /^mock-auth$/, namespace: 'mock-ns' }, () => ({
              contents: \`
                export const useAuth = () => ({ user: { id: 'owner-1' } });
              \`,
              loader: 'js',
            }))
          },
        },
      ],
    })
    await stop()
    `,
    'utf8'
  )

  try {
    execFileSync(process.execPath, [buildScript], { stdio: 'pipe' })

    const mod = await import(pathToFileURL(outFile).href)
    const {
      React,
      useState,
      render,
      screen,
      fireEvent,
      waitFor,
      cleanup,
      OwnershipBreakdownCard,
      ShareInviteModal,
    } = mod
    rtlCleanup = cleanup

    const baseShares = [
      {
        id: 's-owner',
        ticket_id: 'ticket-1',
        user_id: 'owner-1',
        role: 'PROPIETARIO',
        percentage: 100,
        status: 'ACEPTADA',
        prize_paid_confirmed: false,
        prize_paid_confirmed_at: null,
        prize_payout_requested_at: null,
        prize_payout_requested_by: null,
        waiver_requested: false,
        waiver_requested_at: null,
        created_at: '2026-11-01T00:00:00Z',
        updated_at: '2026-11-01T00:00:00Z',
        profiles: { id: 'owner-1', display_name: 'Propietario', avatar_url: null, email: 'o@test.com' },
      },
    ]

    function Harness({ autoOpen = false }: { autoOpen?: boolean }) {
      const [modalInvites, setModalInvites] = useState([])
      return React.createElement(
        'div',
        null,
        React.createElement(OwnershipBreakdownCard, {
          ticketId: 'ticket-1',
          ticketNumber: '02320',
          drawName: 'Sorteo Extraordinario de Navidad',
          ticketStatus: 'PENDIENTE',
          isOwner: true,
          shares: baseShares,
          pendingInvites: [],
          autoOpenCreateShare: autoOpen,
          onRefresh: async () => {},
          onOpenShareModal: (invites: unknown[]) => setModalInvites(invites),
        }),
        React.createElement(ShareInviteModal, {
          isOpen: modalInvites.length > 0,
          onClose: () => setModalInvites([]),
          invitations: modalInvites,
        })
      )
    }

    // 1. Flujo desde Compartir (autoOpenCreateShare=true) -> 2 partes (1 invitación) -> modo individual sin selector de lote
    render(React.createElement(Harness, { autoOpen: true }))
    const createEqualBtn = await screen.findByText('Crear participaciones a partes iguales')
    fireEvent.click(createEqualBtn)

    await waitFor(() => {
      assert.ok(screen.getByText('Compartir Participación'))
      assert.ok(screen.getByText('493072'))
    })
    assert.equal(screen.queryByText(/Código único por persona/i), null)
    cleanup()

    // 2. Flujo 3 partes (2 invitaciones: Parte 2 y Parte 3) -> selector de lote + avance automático tras compartir
    render(React.createElement(Harness, { autoOpen: false }))
    fireEvent.click(screen.getByText(/Crear participación/i))
    // Incrementar partes de 2 a 3 pulsando el botón "+" (siguiente hermano del contador "2")
    const countSpan = await screen.findByText('2')
    const plusBtn = countSpan.nextElementSibling as HTMLButtonElement
    fireEvent.click(plusBtn)
    fireEvent.click(screen.getByText('Crear participaciones a partes iguales'))

    await waitFor(() => {
      assert.ok(screen.getByText(/Invitación 1 de 2 · Código único por persona/))
      assert.ok(screen.getByText('111111'))
      assert.ok(screen.getByText('Parte 2'))
      assert.ok(screen.getByText('Parte 3'))
    })

    // Simular envío por WhatsApp en Parte 2 -> avanza automáticamente a Parte 3 (222222)
    fireEvent.click(screen.getByText('Enviar por WhatsApp'))
    await waitFor(() => {
      assert.ok(screen.getByText('222222'))
      assert.ok(screen.getByText(/Invitación 2 de 2 · Código único por persona/))
    })

    // Simular envío por WhatsApp en Parte 3 -> muestra confirmación y botón Listo
    fireEvent.click(screen.getByText('Enviar por WhatsApp'))
    await waitFor(() => {
      assert.ok(screen.getByText('Todas las invitaciones han sido compartidas'))
      assert.ok(screen.getByText('Listo'))
    })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
