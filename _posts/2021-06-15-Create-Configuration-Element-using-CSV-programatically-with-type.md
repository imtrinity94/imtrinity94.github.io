---
title: "Configuration Element to Json Transformer"
published: true
---
How to create configuration elements in bulk in various dev, staging and production environments. Just create a single csv file and put its content inside this vRO workflow and you are good to go.

*This code also allows you to provide a datatype along with key and value.

```javascript
/* WORKFLOW INPUTS
 categoryPath | string | Category\Path of Configuration Element
 configName | string | Name of Configuration Element
 CSV_CONTENT | string | comman sperated content
 ----------------------------------------------
 -  KEY            TYPE           VALUE       -
 -  username       String         root        -
 -  password       SecureString   password    -
 -  useCount       number         14          -
 -  valid?         boolean        true        -
 ----------------------------------------------
*/
var configCategory = Server.getConfigurationElementCategoryWithPath(categoryPath);
var configElement = null;
if (configCategory) {
    System.log("Found configuration category '" + configCategory.name + "'");
    var configElements = configCategory.configurationElements;
    for (var i in configElements) {
        ce = configElements[i];
        if (ce.name == configName) {
            configElement = ce;
            break;
        }
    }
    if (configElement) {
        System.log("Found configuration '" + configElement.name + "'");
    } else {
        configElement = Server.createConfigurationElement(categoryPath, configName);
        System.log("Created configuration element '" + configElement.name + "'");
    }
} else {
    configElement = Server.createConfigurationElement(categoryPath, configName);
    System.log("Created category path '" + categoryPath + "' and configuration element '" + configElement.name + "'");
}

var _lines = CSV_CONTENT.split("\n"); 
for (var i in _lines) {
    var _fields = _lines[i].split(",");
    var key = _fields[0];
    var type = _fields[1];
    var allValues = _fields[2]; //if value is single (not comma seperated)
    if (_fields.length > 3) { // if value itself has multiple comma seperated values
        for (var j = 3; j < _fields.length; j++)
            allValues += "," + _fields[j];
    }
    configElement.setAttributeWithKey(key,allValues,type);
```
