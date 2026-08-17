import {readXmlToJson} from './services/updateSitemap.js'


let report = await readXmlToJson()
console.log('report = ', report)