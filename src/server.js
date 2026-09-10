import Fastify from 'fastify';
import formbody from '@fastify/formbody';



import { _h } from "helpers_jsonld"

import { scraper } from './index.js';

let PORT = '3017'
let HOST = '0.0.0.0'

let OBSCURA_URL = 'ws://192.168.2.243:9222/devtools/browser'


const fastify = Fastify({ trustProxy: true, logger: true });

fastify.register(formbody);


let s = new scraper.Scraper(OBSCURA_URL)


// POST endpoint with schema validation
fastify.get('/', {}, async (request, reply) => {


    await s.init()

    let actions = s.getActions()

    let actionsContent = actions.map(x => `<li><a href="/actions/${x.record_id}">${x.record_id}</a> - ${x.object[0].url} - ${x.actionStatus} </li>`)

    actionsContent = `<ul>${actionsContent}</ul>`

    let html = `
    

            <form action="/" method="POST">
        <!-- Text Input -->
        <label for="url">url:</label>
        <input type="text" id="url" name="url" required>

       

        <!-- Submit Button -->
        <button type="submit">Submit Data</button>
        </form>
    
        <h2>Actions (${actions.length})</h2>
        ${actionsContent}
        `

    



    reply.type('text/html')
    return html
})


// POST endpoint with schema validation
fastify.post('/', {}, async (request, reply) => {


    let data = request.body
    let url = data?.url
    let action = await s.submitScrapeUrl(url)
    return reply.redirect('/'); 

})



// POST endpoint with schema validation
fastify.get('/scrape', {}, async (request, reply) => {


    let url = request?.query?.url ?? request?.params?.url ?? 'https://www.mondou.com'


    let action = await s.scrapeUrl(url) 

    return reply.code(201).send(action);
});



// POST endpoint with schema validation
fastify.get('/scrape/:browserID', {}, async (request, reply) => {




    let action = new _h.things.Action('Scrape webpage')
    

    let url = request?.query?.url ?? request?.params?.url ?? 'https://www.mondou.com'

    action.object = new _h.things.WebPage(url)

    console.log('url', url)
    let s = new scraper.Scraper(OBSCURA_URL)

    await s.init()


    let result = await s.scrapeUrl(url) 

    action.setCompleted(result)

    return reply.code(201).send(action);
});


fastify.get('/actions', {}, async (request, reply) => {


    let actions = s.getRecords()()
    
    return reply.code(201).send(actions);

});


fastify.get('/actions/:actionID', {}, async (request, reply) => {


    let actionID = request.params?.actionID || request.query?.actionID
   let action = s.getRecord(actionID)
    
    return reply.code(201).send(action);
});



async function startServer(){

    try {
    await fastify.listen( { "port": PORT, "host": HOST } );
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}
}


startServer()