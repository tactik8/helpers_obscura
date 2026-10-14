import { _h } from "helpers_jsonld"

/**
 * Compile data into a WebPage object
 */
export function compileData(result){

    let webpage = {
        "@type": "WebPage",
        "@id": result?.pageData?.url,
        "url": result?.pageData?.url
    }

    // get title
    webpage.title = result?.pageData?.title


    // get description
    webpage.description = result?.pageData?.description



    // get main entity 
    let entities = result?.schemaJsonLd || []
    let productEntities = entities.filter(x => _h.getValues(x, '@type').includes("Product"))

    // Main entity product
    if(productEntities.length == 1){
        let productRecord = fixProductRecord(productEntities[0], webpage.url )
        webpage = _h.setValue(webpage, 'mainEntity', productRecord)
        webpage = _h.addValue(webpage, '@type', "ItemPage")
    }

    // Brand 
    let brands = result?.schemaJsonLd?.brand
    brands = _h.toArray(brands)
    brands = brands.map(x => x?.["@type"] ? x : {"@type": "Brand", "name": x})
    webpage = _h.setValues(webpage, 'brand', brands)


    // 
    


}



function fixProductRecord(productRecord, webpageRecord){


    // Get language
    let language = _h.getValue(webpageRecord, 'inLanguage')
    if(!language){ language = 'en' }

    // Set language
    

    // Set url
    productRecord = _h.setValue(productRecord, 'url', _h.getValue(webpageRecord, 'url'))
    

    // Brand - ensure Brand record
    let brands = productRecord?.brand
    brands = _h.toArray(brands)
    brands = brands.map(x => x?.["@type"] ? x : {"@type": "Brand", "name": x})
    productRecord = _h.setValues(productRecord, 'brand', brands)

    // Offers - ensure itemOffered is not null
    let offers = _h.getValues(productRecord, 'offers')
    offers = offers.map(x => _h.getValue(x, 'itemOffered') ? _h.getValue(x, 'itemOffered') : {"@id": _h.record_id(productRecord)})



    return productRecord
}


function fixOfferRecords(offerRecord, productRecord, webpageRecord){

    // Set url
    offerRecord = _h.setValue(offerRecord, 'url', _h.getValue(webpageRecord, 'url'))
    

    // Brand - ensure Brand record
    let brands = productRecord?.brand
    brands = _h.toArray(brands)
    brands = brands.map(x => x?.["@type"] ? x : {"@type": "Brand", "name": x})
    productRecord = _h.setValues(productRecord, 'brand', brands)

    // Offers - ensure itemOffered is not null
    let offers = _h.getValues(productRecord, 'offers')
    offers = offers.map(x => _h.getValue(x, 'itemOffered') ? _h.getValue(x, 'itemOffered') : {"@id": _h.record_id(productRecord)})



    return productRecord
}

