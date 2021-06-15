---
title: "Data Object in Orchestrator"
published: true
---

# JSON

Creating JSON objects in vRO is pretty simple and straight forward. I mainly use two different methods, depending on the complexity. Method one is creating the object using string concatenation (useful for small and simple objects), and method two is the Properties object, which is, my opinion, better for more complex objects, especially if initially I don’t know how many entries the object is going to have or adding arrays.

Method One:
```javascipt
var jsonObject =
{
      "name": "Matthias",
      "company": "comdivision",
      "hobbies": [
            "cooking","skiing"
      ]
}
```

As we can see, method one is straight forward. I added an array of strings in my example, but it could be an array of properties again. Instead of adding a string as value, input parameters of the scriptable task could be used too, just be careful with the type.

Method Two:
```javascript
var jsonObject = new Properties();
jsonObject.name = "Matthias";
jsonObject.company = "comdivision";
jsonObject.hobbies = ["cooking","skiing"];
```

The second method, as we all can see, is easier and provides a better readability, especially if it comes to large objects.

# XML

For XML we can use two different main methods, but I am sure, there are other possibilities as well. I am using these two, because, especially the second one, it’s easy and straight forward.

Method One:

In the first method, I use simple string concatenation. If the XML object is small, this is a fast and simple approach. It even allows adding dynamic values. As an example, I am going to reuse NSX stuff, creating the XML for the NSX controller deployment, because this is a small and understandable XML structure.

```javascript
var xmlString =
[
'',
      '' + controllerNameVariableString + '',
      'nsx-controller',
      'ipPool-1',
      'domain-c1',
      'datastore-1',
      'dvportgroup-1',
      '' + passwordSecureString + '',
''
].join('\n');
```
This example uses simple string concatenation. Please recognize the square brackets, surrounding all the strings, with the .join method at the end. For “name” and “password” I added dynamic values which are in parameters for the scriptable task to demonstrate how to add dynamic values. The downside of this method is, the result is a string and not an XML object which makes it less flexible for later editing. Of course, it could be converted later.

Method Two:

I am using the same XML but this time I create an E4X object straight ahead, which allows to easily add and/or change values. This is very useful for large XML objects. Be aware, if you’re not changing the value of a specific tag, the value provided during the object creation will remain.

```javascript
controllerSpec.name = controllerName;
controllerSpec.description = "NSX Contoller Cluster Management";
controllerSpec.ipPoolId = ipPoolId;
controllerSpec.resourcePoolId = resourcePoolId;
controllerSpec.datastoreId = datastoreId;
controllerSpec.networkId = portGroupId;
controllerSpec.password = passwordSecureString;
```

Using E4X allows us accessing the tags using a dot. This is great if we deal with larger XML data structures and especially nested structures. Be aware, the second method creates an XML object. If you would like to use it for REST calls, it needs to be converted into string upfront using the .toString() method. 

# Powershell
Creating larger powerShell scripts might be tricky in vRO. I am currently using the already mentioned string concatenation method. It works great for all kind of scripts created for diverse command lines like bash.

For this article, I am using a, what I think, very useful example. I had to deal with powerShell scripts being identical but are executed against various hosts in different domains. I guess, we’re all aware of the double hop issue we have and all the different necessary configurations to get this up and running. What I do is creating a PSCred object on the fly and add it to the script as authentication method used with different cmdlet’s.


```javascript
var powerShellScript =

[
      '$password = "' + passwordSecureString + '" | ConvertTo-SecureString -asPlainText -Force',
      '$username = "' + myCustomUsername + '"',
      '$credential = New-Object System.Management.Automation.PSCredential($username,$password)',
      'gwmi win32_service -credential $credential -computer $computer'
].join('\n');
```





















