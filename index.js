const soap = require("soap");
const Handlebars = require("handlebars");
const beautify = require("js-beautify").js_beautify;
const fs = require("fs");

const commandLineArgs = require("command-line-args");

const optionArgDefinitions = [
  { name: "input", alias: "i", type: String },
  { name: "output", alias: "o", type: String },
  { name: "help", alias: "h", type: Boolean },
];

let args = undefined;

const templateString = `{{#*inline "partialDesc"}}
  {{name}} of type {{#ifstring value}}{{value}}{{else}} {
      {{#eachkey value }} 
        {{> partialDesc}}
      {{/eachkey}}
    }{{/ifstring}}
{{/inline}}

const services={ /* Services */
  
  {{#eachkey this sep=","}}
    {{name}}:{ /* Ports */
    
    {{#eachkey value sep=","}}
      {{name}}:{ /* Methods */

        {{#eachkey value sep=","}}
          {{name}}: (args, callback, headers, req) => {
            /*
              args = {
                {{#eachkey value.input}} 
                   {{> partialDesc}}
                {{/eachkey}}
              }
            */
            //
            // Your code
            //
            /* return {
                {{#eachkey value.output}} 
                   {{> partialDesc}}
                {{/eachkey}}

            }; */
          }
        {{/eachkey}}

      }
    {{/eachkey}}
    }
  {{/eachkey}}
};`;

try {
  args = commandLineArgs(optionArgDefinitions);
} catch (e) {
  console.log(e);
}

if (args == undefined || args.help != undefined || args.input == undefined) {
  if (args == undefined) {
    console.error("invalid argument");
  }
  if (args != undefined && args.input == undefined) {
    console.error("Input wsdl file or url is mandatory");
  }
  console.log("Usage:");
  console.log(process.argv[0] + " -i wsdl_access [-o jsstubfile]");
  return;
}

let outputfile = undefined;
if (args.output != undefined) {
  outputfile = args.output;
}

let inputfile = undefined;
inputfile = args.input;

const ObjectStack = [];

const containsObject = (obj, list) => {
  let i;
  for (i = 0; i < list.length; i++) {
    if (list[i] === obj) {
      return true;
    }
  }

  return false;
};

const fixBugOnTypeAndLoop = (obj) => {
  console.log(obj);
  if (typeof obj === "string" || obj instanceof String) {
    return obj;
  }

  ObjectStack.push(obj);
  const newObj = {};
  let param = "";
  const keys = Object.keys(obj);
  for (let i = 0, j = keys.length; i < j; i++) {
    key = keys[i];
    if (!isNaN(key)) {
      param += obj[key];
    } else {
      if (param != "") {
        const lparam = param.split("|");
        newObj[lparam[0]] = lparam[1];
        param = "";
      }
      if (obj[key] != null && !containsObject(obj[key], ObjectStack)) {
        newObj[key] = fixBugOnTypeAndLoop(obj[key]);
      }
    }
  }
  ObjectStack.pop();

  return newObj;
};

Handlebars.registerHelper("eachkey", (context, options) => {
  if (containsObject(context, ObjectStack)) {
    return "";
  }
  ObjectStack.push(context);

  let ret = "";
  if (context == undefined) {
    return "";
  }
  const keys = Object.keys(context);
  for (let i = 0, j = keys.length; i < j; i++) {
    key = keys[i];
    sep = "";
    sepa = "";
    if (i != 0 && options.hash["sep"] != undefined) {
      sep = options.hash["sep"];
    }
    ret =
      ret +
      sep +
      options.fn({
        name: key,
        value: context[key],
      }) +
      sepa;
  }
  ObjectStack.pop();
  return ret;
});

Handlebars.registerHelper("ifstring", function (conditional, options) {
  if (typeof conditional === "string" || conditional instanceof String) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

//const serviceTemplateString = fs.readFileSync(__dirname + "/services.handlebars", 'utf8');
//const serviceTemplate = Handlebars.compile(serviceTemplateString);
const serviceTemplate = Handlebars.compile(templateString);

const buildStub = (obj) => {
  obj = fixBugOnTypeAndLoop(obj);
  const result = beautify(serviceTemplate(obj), { indent_size: 2 });
  console.log(result);
  if (outputfile != undefined) {
    fs.writeFileSync(outputfile, result, { encoding: "utf8" });
  }
};

soap.createClient(inputfile, (err, client) => {
  let obj = client.describe();
  buildStub(obj);
});

const convertServices = (obj) => {
  const services = Object.keys(obj);
  return services;
};
