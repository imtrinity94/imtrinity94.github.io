---
title: "Configuration Element to Json Transformer"
published: true
---

I love using Configuration Elements in VMware vRO to store repetitive information. What I don’t like is making multiple calls to get information back or making a call which pulls back a load of data that I then have to man handle through my flow to where I need it.

To make life easier, I use some code in an action to go to a configuration element path and then pull back all the elements and their attributes underneath. This code then constructs a structured JSON object from it, so you can simply pass it around throughout the flow and pull the data back when you need it.

I have taken the code from the action and flattened it out below for you to use. A great benefit of this, is every time you add more data to your Configuration Element category, you don’t have to change any code to get the information out.

In the code below you would replace ‘AutomationPro/Example’ with your Category path.

## Javascript
```javascript
var category = Server.getConfigurationElementCategoryWithPath("AutomationPro/Example");
if (category == null) {
throw "Configuration element category '" + categoryPath + "' not found or empty!";
}
var elements = [];
for (i = 0; i < category.configurationElements.length; i++) {
var jsonString = "";
var configElementName = category.configurationElements[i].name;
for each (var attr in category.configurationElements[i].attributes) {
jsonString += '"' + attr.name + '"' + ":" + '"' + attr.value + '",';
}
var finalString = '"' + configElementName + '": {' + jsonString + "}";
elements.push(finalString);
}
jsonOut = "{" + elements.join(",") + "}";
System.debug(jsonOut);
```
