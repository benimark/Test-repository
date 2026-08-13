import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'

describe('GET /api/health', () => {
  it('reports that the server is up', async () => {
    const response = await request(createApp()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok' })
    expect(response.body.uptime).toBeGreaterThan(0)
    expect(Date.parse(response.body.timestamp)).not.toBeNaN()
  })
})

describe('unknown API routes', () => {
  it('answer with JSON instead of falling through to the SPA', async () => {
    const response = await request(createApp()).get('/api/nope')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Not Found' })
  })
})
