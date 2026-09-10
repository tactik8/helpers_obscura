
# Installation
```
npm install github:tactik8/helpers_jsonld
```


## Development
for development continuous :
```
npx nodemon index.js
```

for testing :
```
npm test
```

## Build
for packaging:
```
npm run build
```


## Functionalities

### helpers.records
Provides pre-made records, useful for testing purposes

- helpers.records.action
- helpers.records.address
- helpers.records.article
- helpers.records.image
- helpers.records.itemList
- helpers.records.person
- helpers.records.product
- helpers.records.thing



## How to use


### Standardize / Clean records
Ensure all records have @id, standardize @id


```
import * as helpers from 'jsonld_helpers' 

// Clean record (ensure all records have @id, standardize @id)
let record = {...}
let baseUrl = 'https://testdomain.com'
record = helpers.clean(record, baseUrl)

```


### Flatten records

```
import * as helpers from 'helpers_jsonld' 

// Flatten record
let record = {...}
let records = helpers.flatten(record)

```



### Dedupe records


```
import * as helpers from 'helpers_jsonld' 

let record = {...}

let db = new helpers.DB()

db.post(record)

let dedupedRecords = db.records

```


### Use as database (in memory)
```

import * as helpers from 'helpers_jsonld' 


let db = new helpers.DB()

db.post(record)


let r2 = db.get('someRecordId')


db.delete('someRecordId')


```


### Test conditions 

```

import * as helpers from 'helpers_jsonld' 

let c = {
    "@type": "Thing"
}



```
