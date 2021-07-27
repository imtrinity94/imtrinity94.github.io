---
title: "Creating vRO Configuration Element in Bulk using CSV file"
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
 -  url            path           /bin/conf/  -
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
<h2>Input</h2>

![Screenshot_1](https://user-images.githubusercontent.com/7029361/127157316-1697a1ca-b6ee-4c7b-9aa2-5725f05f699c.png)

<h2>Output</h2>

![Screenshot_2](https://user-images.githubusercontent.com/7029361/127157337-621b8448-0104-4e14-aa79-8e4bea2a74b9.png)


