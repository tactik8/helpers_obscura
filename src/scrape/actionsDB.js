
import fs from 'fs/promises';
import path from 'path';
import { _h } from "helpers_jsonld"

let DIRECTORY = process.env.DATA_DIRECTORY ?? "./db" 


export class ActionDB {
    constructor(){

        this.isinit = false
        this.directory = DIRECTORY
        this.dbFilename = "db.json"
        this.actions = []
        this.lastSave = undefined

    }

    async init(){

        if(this.isinit == true){
            return
        }

        await ensureDirectoryExists(this.directory)
        await this.load()
        this.isinit = true
        return
    }


    active(){
        return this.actions.filter()
    }


    get(actionID){
        let action = this.actions.find(x => x.record_id == actionID)
        return action
    }

    getAll(){
        return this.actions
    }

    set(action){
        this.actions = this.actions.filter(x => x.record_id != action.record_id)
        this.actions.push(action)
        this.save()
        return
    }


    getRecord(actionID){
        let record = this.get(actionID)
        return record?.record ?? record
    }

     getRecords(){
        let records = this.getAll()
        return records.map(x => x?.record ?? x)
    }



    async save(){
        let actions = this.actions
        actions = actions.map(x => x?.record ?? x)
        await saveTextFile(this.directory, this.dbFilename, actions)
        this.lastSave = new Date()
        console.log('Save')
    }
    async load(){
        let actions = await loadTextFile(this.directory, this.dbFilename) || []

        for(let action of actions){

            let w = new _h.things.WebPage()
            w._record = action.object
            

            let a = new _h.things.Action()
            a.record = action
            a._record.object = w
            

            this.actions.push(a)
            
        }
        
        let activeActions = this.actions.filter(x => x.isActive == true)
        activeActions.forEach(x => x.setFailed('Server restart'))

        this.save()
        console.log('DB loaded')
    }
}


async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Directory is ready: ${dirPath}`);
    } catch (error) {
        console.error(`Error creating directory: ${error.message}`);
        throw error;
    }
}

async function saveTextFile(filePath, filename, record) {

    let content = ''
    try {
        content = JSON.stringify(record, null, 4)
    } catch(err){
        console.error(`Error json stringify: ${err} ${record}`);
        return
    }
    try {
        await fs.writeFile(filePath + '/' + filename, content, 'utf8');
        console.log(`File successfully saved to: ${filePath}`);
    } catch (error) {
        console.error(`Error saving file: ${error.message}`);
        throw error;
    }
}

async function loadTextFile(filePath, filename) {
    try {
        let text = await fs.readFile(filePath + '/' + filename, 'utf8');
        try {
            return JSON.parse(text)
        } catch(err){
            console.error(`Non valid content: ${text}`);
            return []
        }
    } catch (error) {

        let e = String(error)
        if(e.includes('no such file or directory')){
            return []
        }
        console.error(`Error loading file: ${error.message}`);
        throw error;
    }
}