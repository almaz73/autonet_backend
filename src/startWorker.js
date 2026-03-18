import {Version} from "./constants.js";
import Controllers from "./xml_import/Controllers.js";

let report = `\n\nОтчет ${Version}`
await Controllers.workerImportXML();
console.log(report)
