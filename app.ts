import { Hono } from "https://deno.land/x/hono@v3.11.10/mod.ts"
import { serveStatic } from "https://deno.land/x/hono@v3.11.10/middleware.ts"
import { streamSSE } from "https://deno.land/x/hono@v3.11.10/helper/streaming/index.ts"

const db = await Deno.openKv()
const app = new Hono()
let i = 0

interface lastVisit {
    city: string
    country: string
    flag: string
}

app.get('/', serveStatic({ path: 'index.html' }))


app.post('/visit', async (c) => {
    const {city, country, flag} = await c.req.json<lastVisit>()

    await db.atomic()
    .set(["lastVisit"], { country, city, flag })
    .sum(["visits"], 1n)
    .commit()
    return c.json({ message : 'ok'})
})

app.get('/visit', (c) => {
    return streamSSE(c, async (stream) => {
        const watcher = db.watch([["lastVisit"]])

        for await (const entry of watcher) {
            const { value } = entry[0]
            if (value != null) {
                await stream.writeSSE({ data: JSON.stringify(value), event: 'update', id: String(i++)})
            }
        }
    })
})

/* app.get('/counter', (c) => {
    return streamSSE(c, async (stream) => {
        const visitsKey = ["visits"]
        const listOfKeyToWatch = [visitsKey]
        const watcher = db.watch(listOfKeyToWatch)

        for await (const entry of watcher) {
            const { value } = entry[0]
            if (value != null) {
                await stream.writeSSE({ data: value.toString(), event: 'update', id: String(i++)})
            }
        }

        const { value } = await db.get(["visits"])
        await stream.writeSSE({ data: Number(value).toString(), event: 'update', id: String(i++)})
        await stream.sleep(1000)
         while(true){
            const message = `Son las ${new Date().toLocaleTimeString()}`
            await stream.writeSSE({ data: message, event: 'update', id: String(i++)})
            await stream.sleep(1000)
        }
    })
}) */

Deno.serve(app.fetch)