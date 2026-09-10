import puppeteer from 'puppeteer-core';
import { extractAll } from './extractMethods.js'
import { _h } from "helpers_jsonld"
import { setTimeout } from 'node:timers/promises';

import { ActionDB } from './actionsDB.js'

let actionDB = new ActionDB()


export class Scraper {
    constructor(api_url) {
        this._api_url = api_url
        this.browser
        this.page
    }

    async init() {

        if (this.browser) {
            return
        }

        await actionDB.init()

        this.browser = "pending"
        this.browser = await puppeteer.connect({
            browserWSEndpoint: this._api_url,
        });

        this.page = await this.browser.newPage();


        this.startEngine()



    }

    async startEngine() {

        this._scrapenEngineStatus()

        this._scraperEngine()


    }

    async close() {
        await this.browser.close()
        this.browser = undefined
        this.page = undefined
        return
    }

    getAction(actionID) {


        return actionDB.get(actionID)
    }

    getActions() {

        return actionDB.getAll()
    }

    getRecord(actionID){
        return actionDB.getRecord(actionID)
    }
     getRecords(){
        return actionDB.getRecords()
    }

    async submitScrapeUrl(url) {
        await this.init()
        let action = new _h.things.Action('Scrape webpage')
        action.object = new _h.things.WebPage(url)
        action.setPotential()
        actionDB.set(action)
        return action.record

    }


    async scrapeUrl(url) {

        await this.init()

        let action = new _h.things.Action('Scrape webpage')
        action.object = new _h.things.WebPage(url)
        actionDB.set(action)


        await this.page.goto(url, { waitUntil: 'domcontentloaded' });

        let results = await extractAll(this.page, url)

        action.setCompleted(results)
        actionDB.set(action)

        return action.record

    }







    async _scrapenEngineStatus() {


        while (true) {

            let actions = actionDB.actions

            let p = actions.filter(x => x.isPotential == true).length
            let a = actions.filter(x => x.isActive == true).length
            let c = actions.filter(x => x.isCompleted == true).length
            let f = actions.filter(x => x.isFailed == true).length

            console.log(`Engine status - Potential:${p} Active: ${a} Completed:${c} Failed: ${f}`)
            await setTimeout(10000);


        }
    }

    async _scraperEngine() {



        while (true) {


            let actions = actionDB.actions

            actions = actions.filter(x => x.isPotential == true)

            let action = actions?.[0]

            if (action) {
                console.log(`Scraping started ${action.object[0].url}`)
                action.setActive()
                actionDB.set(action)
                let r = await this._scraperWorker(action)
                console.log(`Scraping completed ${action.object[0].url}`)
            }

            await setTimeout(1000);
        }


    }

    async _scraperWorker(action) {

        let url = action.object[0].url
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });

        let results = await extractAll(this.page, url)

        action.setCompleted(results)
        actionDB.set(action)
        return
    }
}