/*
 *   Copyright (C) 2024 Sellers Industries, Inc.
 *   distributed under the MIT License
 *
 *   author: Evan Sellers <sellersew@gmail.com>
 *   date: Mon Mar 04 2024
 *   file: transformer.ts
 *   project: SherpaJS - Module Microservice Platform
 *   purpose: Native Request to SherpaJS Request
 *
 */


import { IRequest } from "./interface.js";
import { RequestUtilities } from "./utilities.js";
import { Headers, Body, BodyType, Method } from "../model.js";
import { Segment } from "../../../compiler/models.js";
import { OriginURL } from "../../../compiler/utilities/url/index.js";
import { IncomingMessage as LocalRequest } from "http";
type VercelRequest = Request;


export class RequestTransform {


    static async Local(req:LocalRequest, segments:Segment[]):Promise<IRequest> {
        if (!req.url || !req.method) {
            throw new Error("Missing URL and Methods");
        }
        let headers = new Headers(req.headers);
        let { body, bodyType } = await this.parseBodyLocal(req, headers);
        return {
            url: new OriginURL(req.url).pathname,
            params: {
                path: RequestUtilities.parseParamsPath(req.url, segments),
                query: RequestUtilities.parseParamsQuery(req.url),
            },
            method: req.method.toUpperCase() as keyof typeof Method,
            headers: headers,
            body: body,
            bodyType: bodyType
        }
    }


    private static parseBodyLocal(req:LocalRequest, headers:Headers):Promise<{ body:Body, bodyType:BodyType }> {
        return new Promise((resolve, reject) => {
            if (req.method.toUpperCase() == Method.GET) {
                resolve({ body: undefined, bodyType: BodyType.None });
                return;
            }

            let body:Body = "";
            let bodyType  = BodyType.Text;
    
            req.on("data", (chunk: Buffer) => {
                body += chunk.toString();
            });
    
            req.on("end", () => {
                let contentType = (headers.get("Content-Type") || "").toLowerCase();
                if (!contentType || body == "") {
                    resolve({
                        body: undefined,
                        bodyType: BodyType.None
                    });
                }

                if (contentType == "application/json") {
                    body     = JSON.parse(body as string);
                    bodyType = BodyType.JSON;
                }
    
                resolve({
                    body,
                    bodyType
                });
            });
    
            req.on("error", (error:Error) => {
                resolve({ body: undefined, bodyType: BodyType.None });
            });
        });
    }


    static async Vercel(req:VercelRequest, segments:Segment[]):Promise<IRequest> {
        let headers = new Headers(req.headers);
        let { body, bodyType } = await this.parseBodyVercel(req, headers);
        return {
            url: new OriginURL(req.url).pathname,
            params: {
                path: RequestUtilities.parseParamsPath(req.url, segments),
                query: RequestUtilities.parseParamsQuery(req.url),
            },
            method: req.method.toUpperCase() as keyof typeof Method,
            headers: headers,
            body: body,
            bodyType: bodyType
        }
    }


    private static async parseBodyVercel(req:VercelRequest, headers:Headers):Promise<{ body:Body, bodyType:BodyType }> {
        if (req.method.toUpperCase() == Method.GET) {
            return { body: undefined, bodyType: BodyType.None };
        }
        let contentType = (headers.get("Content-Type") || "").toLowerCase();
        if (!contentType) {
            return { body: undefined, bodyType: BodyType.None };
        }
        if (contentType == "application/json") {
            return { body: await req.json(), bodyType: BodyType.JSON };
        }
        return { body: await req.text(), bodyType: BodyType.Text };
    }


}


// Therefore I tell you, whatever you ask for in prayer, believe that you have
// received it, and it will be yours.
// - Mark 11:24
