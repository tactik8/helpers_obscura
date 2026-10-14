import { XMLParser } from 'fast-xml-parser';

import { _h } from 'helpers_jsonld'

export async function getSitemap(sitemapUrl) {

    console.log('Get sitemap started for', sitemapUrl)

    // Get sitemap location from robots.xml



    let sitemaps =  await getSitemapsFromRobotsTxt(sitemapUrl)

    sitemaps = sitemaps.concat(getCommonSitemaps(sitemapUrl))

    // Get urls in sitemap
    let results = await getSitemapUrls(sitemaps)

    // Transform from xml format to schema
    results = sitemapXmlToSchema(results)

    // Dedupe
    results = deduplicateWebpageRecords(results)


    console.log('Get sitemap completed for', sitemapUrl)

    return results
}



function sitemapXmlToSchema(xmlRecords){

    xmlRecords = _h.toArray(xmlRecords)

    let results = []
    for(let xmlRecord of xmlRecords){

        let r = {
            "@type": "WebPage",
            "@id": (xmlRecord?.loc || "") + '#webpage',
            "url": xmlRecord?.loc || "",
            "dateModified": new Date(xmlRecord?.lastmod)
        }
        results.push(r)
    }

    return results
}



function deduplicateWebpageRecords(records){

    let results = []
    let urls = []
    for(let r of records){
        let url = r?.url
        if(url && urls.includes(url) == false){
            results.push(r)
            urls.push(url)
        }
    }
    return results
}



function getCommonSitemaps(baseUrl){

    try {
        const urlObj = new URL(baseUrl);
        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

        let locations = ['/sitemap-index.xml', '/sitemap.php', '/sitemap.txt', '/sitemap.xml.gz', '/sitemap/','/sitemap/sitemap.xml', '/sitemapindex.xml','/sitemap/index.xml',' /sitemap1.xml']

        let results = locations.map(x => baseUrl + x)
        
        return results



    } catch (err){}

    return []


}



/**
 * Retrieves sitemap location from robots.txt
 * @param {*} baseUrl 
 * @returns 
 */
async function getSitemapsFromRobotsTxt(baseUrl) {
    try {
        // Ensure the base URL is formatted correctly (e.g., https://example.com)
        const urlObj = new URL(baseUrl);
        const robotsUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;

        console.log(`Fetching robots.txt from: ${robotsUrl}`);
        const response = await fetch(robotsUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch robots.txt (Status: ${response.status})`);
        }

        const robotsText = await response.text();
        const lines = robotsText.split(/\r?\n/);
        const sitemapUrls = [];

        // Scan each line for the "Sitemap:" directive
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.toLowerCase().startsWith('sitemap:')) {
                // Extract everything after "Sitemap:" and trim whitespace
                const sitemapUrl = trimmedLine.substring(8).trim();
                if (sitemapUrl) {
                    sitemapUrls.push(sitemapUrl);
                }
            }
        }

        return sitemapUrls;

    } catch (error) {
        console.error(`Error reading robots.txt: ${error.message}`);
        return [];
    }
}

/**
 * Retrieves urls from sitemaps. Works with nested sitemaps
 * @param {*} sitemapUrl 
 * @returns 
 */
async function getSitemapUrls(sitemapUrl) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true // Simplifies tags like <xhtml:link> to <link>
    });

    try {
        console.log(`Fetching sitemap: ${sitemapUrl}`);
        const response = await fetch(sitemapUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlText = await response.text();
        const jsonObj = parser.parse(xmlText);

        let allUrls = [];

        // Case 1: It's a Sitemap Index (contains a list of other sitemaps)
        if (jsonObj.sitemapindex && jsonObj.sitemapindex.sitemap) {
            const sitemaps = Array.isArray(jsonObj.sitemapindex.sitemap) 
                ? jsonObj.sitemapindex.sitemap 
                : [jsonObj.sitemapindex.sitemap];

            console.log(`Found sitemap index with ${sitemaps.length} sub-sitemaps. Fetching them...`);

            for (const sm of sitemaps) {
                if (sm.loc) {
                    // Recursively fetch sub-sitemaps
                    const subUrls = await getSitemapUrls(sm.loc);
                    allUrls.push(...subUrls);
                }
            }
        } 
        // Case 2: It's a standard URL set sitemap
        else if (jsonObj.urlset && jsonObj.urlset.url) {
            const urls = Array.isArray(jsonObj.urlset.url) 
                ? jsonObj.urlset.url 
                : [jsonObj.urlset.url];

            for (const entry of urls) {
                if (entry.loc) {
                    allUrls.push({
                        loc: entry.loc,
                        lastmod: entry.lastmod || null,
                        changefreq: entry.changefreq || null,
                        priority: entry.priority || null
                    });
                }
            }
        }

        return allUrls;

    } catch (error) {
        console.error(`Error parsing sitemap (${sitemapUrl}): ${error.message}`);
        return [];
    }
}

