import express from 'express'
import cors from 'cors'
import { fetchUrl, searchWeb } from './scraper.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Fetch URL content
app.post('/api/fetch', async (req, res) => {
  const { url, maxLength = 8000 } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    const content = await fetchUrl(url, { maxLength })
    res.json({ success: true, content })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Fetch multiple URLs
app.post('/api/fetch-multiple', async (req, res) => {
  const { urls, maxLength = 8000 } = req.body

  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'URLs array is required' })
  }

  const results = {}
  await Promise.all(
    urls.map(async (url) => {
      try {
        const content = await fetchUrl(url, { maxLength })
        results[url] = { success: true, content }
      } catch (error) {
        results[url] = { success: false, content: '', error: error.message }
      }
    })
  )

  res.json(results)
})

// Web search
app.post('/api/search', async (req, res) => {
  const { query, maxResults = 5 } = req.body

  if (!query) {
    return res.status(400).json({ error: 'Query is required' })
  }

  try {
    const results = await searchWeb(query, { maxResults })
    res.json({ success: true, results })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`)
})
