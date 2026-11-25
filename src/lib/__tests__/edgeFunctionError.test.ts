import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractFunctionErrorMessage } from '../edgeFunctionError.ts'

test('extractFunctionErrorMessage - extrae body.error desde Response en FunctionsHttpError', async () => {
  const response = new Response(
    JSON.stringify({ error: 'Solo el propietario del décimo puede simular premios' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )
  const functionsHttpError = {
    message: 'Edge Function returned a non-2xx status code',
    context: response,
  }

  const msg = await extractFunctionErrorMessage(functionsHttpError)
  assert.equal(msg, 'Solo el propietario del décimo puede simular premios')
})

test('extractFunctionErrorMessage - extrae body.message o texto plano si no hay campo error', async () => {
  const responseWithMessage = new Response(
    JSON.stringify({ message: 'La sesión de usuario ha expirado' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
  const msg1 = await extractFunctionErrorMessage({
    message: 'Edge Function returned a non-2xx status code',
    context: responseWithMessage,
  })
  assert.equal(msg1, 'La sesión de usuario ha expirado')

  const textResponse = new Response('Servicio temporalmente saturado', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  })
  const msg2 = await extractFunctionErrorMessage({
    message: 'Edge Function returned a non-2xx status code',
    context: textResponse,
  })
  assert.equal(msg2, 'Servicio temporalmente saturado')
})

test('extractFunctionErrorMessage - cae al mensaje original o fallback cuando no hay context legible', async () => {
  const msg1 = await extractFunctionErrorMessage({ message: 'Failed to fetch' })
  assert.equal(msg1, 'Failed to fetch')

  const msg2 = await extractFunctionErrorMessage(null, 'Error por defecto')
  assert.equal(msg2, 'Error por defecto')
})

test('prizeService y check-prizes integran extracción de errores y simulación determinista', () => {
  const prizeServiceSource = readFileSync(
    resolve(process.cwd(), 'src/services/prizeService.ts'),
    'utf8'
  )
  const edgeFnSource = readFileSync(
    resolve(process.cwd(), 'supabase/functions/check-prizes/index.ts'),
    'utf8'
  )

  assert.ok(
    prizeServiceSource.includes('extractFunctionErrorMessage'),
    'prizeService.ts debe usar extractFunctionErrorMessage al manejar error de invoke'
  )
  assert.ok(
    edgeFnSource.includes('isSimulationRequest') &&
      edgeFnSource.includes('simulatedPrizeCents') &&
      edgeFnSource.includes('simulatedPrizePerDecimo'),
    'check-prizes debe soportar simulación determinista sin llamadas externas'
  )
  assert.ok(
    edgeFnSource.includes('corsHeaders'),
    'check-prizes debe devolver cabeceras CORS en todas las respuestas'
  )
})
