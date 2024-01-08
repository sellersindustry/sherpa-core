import path from "path";
import { build, transform } from "esbuild";
import type { BuildOptions, TransformOptions } from "esbuild";
import { Endpoint, VALID_EXPORTS } from "../models";
import fs from "fs";
import { Utility } from "../utilities";


const VERCEL_FUNCTION_CONFIG = {
    "runtime": "edge",
    "entrypoint": "index.js"
};


export async function Bundle(endpoints:Endpoint[], output:string) {
    for (let endpoint of endpoints) {
        await bundleEndpoint(endpoint, output);
    }
    fs.writeFileSync(Utility.File.JoinPath(output, "config.json"), JSON.stringify(
        {
            "version": 3,
            "routes": endpoints.map((endpoint) => {
                return {
                    "src": "/" + endpoint.route.map((route) => route.isDynamic ? `(?<${route.name}>.*)` : route.name).join("/"),
                    "dest": "/" + endpoint.route.map((route) => route.isDynamic ? `[${route.name}]` : route.name).join("/") + "?" + endpoint.route.filter((route) => route.isDynamic).map((route) => route.name + "=$" + route.name).join("&"),
                }
            })
        }
    ));
}


async function bundleEndpoint(endpoint:Endpoint, output:string) {
    let route    = endpoint.route.map((route) => route.isDynamic ? `[${route.name}]` : route.name).join("/");
    let location = Utility.File.JoinPath(output, "functions", route, "/index.func");
    try {
        await build({
            entryPoints: [endpoint.filepath],
            outfile: Utility.File.JoinPath(location, "endpoint.js"),
            target: "es2020",
            format: "esm",
            bundle: true,
            allowOverwrite: true,
            treeShaking: true,
            minify: true,
        });
        buildEdgeConfig(location);
        buildHandler(endpoint, location);
    } catch (e) {
        console.error(e);
    }
}


function buildEdgeConfig(output:string) {
    let buffer = JSON.stringify(VERCEL_FUNCTION_CONFIG);
    fs.writeFileSync(Utility.File.JoinPath(output, ".vc-config.json"), buffer);
}


function buildHandler(endpoint:Endpoint, location:string) {
    let buffer = getEdgeHandlerCode(endpoint);
    fs.writeFileSync(Utility.File.JoinPath(location, "index.js"), buffer);
}


function getEdgeHandlerCode(endpoint:Endpoint) {
    let varibles = endpoint.exports.filter(o => VALID_EXPORTS.includes(o));
    return `// Generated by SherpaJS
        import { ${varibles.join(", ")} } from "./endpoint";

        export default async function index(request, event) {
            switch (request.method) {
                ${varibles.map((variable) => {
                    return `case "${variable}": return ${variable}(request);`;
                }).join("\n")}
            }
            return new Response("Unsupported method \\"" + request.method + "\\".", { status: 405 });
        }
    `.split("\n").map(o => o.startsWith("        ") ? o.replace("        ", "") : o).join("\n");
}

