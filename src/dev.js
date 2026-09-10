import { scraper } from './index.js';




async function test() {

    let url = "https://www.mondou.com"

    let result = await scraper.scrapeUrl(url)
    console.log('ppp')
    console.log(JSON.stringify(result, null, 2))
}

async function test2() {

    let url = "https://www.mondou.com"

    let result = await scraper.getSitemap(url)
    console.log('ppp')
    console.log(JSON.stringify(result, null, 2))
    console.log(`Total URLs extracted: ${result.length}`);
}


test2()