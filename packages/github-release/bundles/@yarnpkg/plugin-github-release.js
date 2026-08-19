/* eslint-disable */
//prettier-ignore
module.exports = {
name: "@yarnpkg/plugin-github-release",
factory: function (require) {
"use strict";var plugin=(()=>{var G=Object.create;var L=Object.defineProperty;var V=Object.getOwnPropertyDescriptor;var K=Object.getOwnPropertyNames;var B=Object.getPrototypeOf,Z=Object.prototype.hasOwnProperty;var R=(a=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(a,{get:(e,t)=>(typeof require<"u"?require:e)[t]}):a)(function(a){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+a+'" is not supported')});var q=(a,e)=>{for(var t in e)L(a,t,{get:e[t],enumerable:!0})},H=(a,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of K(e))!Z.call(a,n)&&n!==t&&L(a,n,{get:()=>e[n],enumerable:!(o=V(e,n))||o.enumerable});return a};var X=(a,e,t)=>(t=a!=null?G(B(a)):{},H(e||!a||!a.__esModule?L(t,"default",{value:a,enumerable:!0}):t,a)),Y=a=>H(L({},"__esModule",{value:!0}),a);var ue={};q(ue,{default:()=>me});var m=R("@yarnpkg/core"),f=R("@yarnpkg/fslib"),E=R("@yarnpkg/libzip");var u=R("@yarnpkg/core"),h=R("@yarnpkg/fslib");var P="github-release:",k="github-release-asset:";var Q=new Map,ee=new Map;function te(a){return a.scope!==null?`@${a.scope}-${a.name}-${a.scope.length}`:a.name}async function ae(a,e){return await u.miscUtils.getFactoryWithDefault(Q,a.identHash,async()=>{try{return await h.xfs.readJsonPromise(e)}catch{return null}})}async function re(a,{configuration:e,cached:t,cachedPath:o}){return await u.miscUtils.getFactoryWithDefault(ee,a.identHash,async()=>{let n=[],p={accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10"},i=await le(e);i&&(p.authorization=i);let l=1;for(;;){let r=await u.httpUtils.request(`https://api.github.com/repos/${a.scope}/${a.name}/releases?page=${l}`,null,{method:u.httpUtils.Method.GET,configuration:e,jsonResponse:!0,headers:p}),d=r.body;if(t&&l===1&&t.lastModified===d[0].updated_at)return t;if(n.push(...r.body),![r.headers.link].flat().join("|").includes('rel="next"'))break;l++}let s={lastStoredAt:new Date().toISOString(),lastModified:n[0]?.updated_at,metadata:{releases:n.map(se)}};return Promise.resolve().then(async()=>{let r=`${o}-${process.pid}.tmp`;await h.xfs.mkdirPromise(h.ppath.dirname(r),{recursive:!0}),await h.xfs.writeJsonPromise(r,s,{compact:!0}),await h.xfs.renamePromise(r,o)}).catch(()=>{}),s})}async function N(a,{cache:e,project:t}){let{configuration:o}=t,n=h.ppath.join(ce(o),te(a)),p=null;if(!t.lockfileNeedsRefresh&&(p=await ae(a,n),p&&o.get("enableOfflineMode"))){let i=structuredClone(p.metadata);return e&&(i.releases=i.releases.filter(l=>{let s=u.structUtils.makeLocator(a,u.structUtils.makeRange({protocol:P,selector:l.tag_name,source:null,params:{id:String(l.id)}})),r=e.getLocatorMirrorPath(s);return r&&h.xfs.existsSync(r)})),i}return(await re(a,{configuration:o,cached:p,cachedPath:n})).metadata}async function $(a,e,t,{cache:o,project:n}){let{releases:p}=await N(a,{cache:o,project:n}),i=e?p.find(l=>l.id===e):p.find(l=>l.tag_name===t);if(!i)throw new Error(`Unable to find release ${t} (id: ${e})`);return i}async function S(a,e,{project:t}){let{browser_download_url:o,content_type:n}=await u.httpUtils.get(`https://api.github.com/repos/${a.scope}/${a.name}/releases/assets/${e}`,{configuration:t.configuration,jsonResponse:!0});return{content:await u.httpUtils.get(o,{configuration:t.configuration,jsonResponse:!1}),content_type:n}}var ne=["name","tag_name","id","created_at","updated_at","assets[].name","assets[].id","assets[].content_type"];function se({assets:a,created_at:e,id:t,name:o,tag_name:n,updated_at:p}){return{assets:a.map(oe),created_at:e,id:t,name:o,tag_name:n,updated_at:p}}function oe({id:a,name:e,content_type:t}){return{id:a,name:e,content_type:t}}var ie=u.hashUtils.makeHash("time",...ne).slice(0,6);function ce(a){return h.ppath.join(a.get("globalFolder"),`metadata/github.com-releases/${ie}`)}async function le(a){return null}var c=R("@yarnpkg/core"),J=X(R("semver"));var w=R("@yarnpkg/fslib");function W(a,e){return c.miscUtils.mapAndFilter(e,t=>{try{let o=new c.semverUtils.SemVer(t.tag_name);if(a.test(o))return{value:t,version:o}}catch{}return c.miscUtils.mapAndFilter.skip})}var C=class{supportsDescriptor(e){if(e.scope==null||!e.range.startsWith(P))return!1;let{selector:t}=c.structUtils.parseRange(e.range);return!!c.semverUtils.validRange(t)}supportsLocator(e){if(e.scope==null||!e.reference.startsWith(P))return!1;let{selector:t,params:o}=c.structUtils.parseRange(e.reference);return!(!J.valid(t)||typeof o?.id!="string")}shouldPersistResolution(){return!0}bindDescriptor(e){return e}getResolutionDependencies(){return{}}async getCandidates(e,t,{project:o,fetchOptions:n}){let{selector:p,params:i}=c.structUtils.parseRange(e.range),l=c.semverUtils.validRange(p);if(l===null)throw new Error(`Expected a valid range, got ${p}`);let{releases:s}=await N(e,{project:o,cache:n?.cache});return W(l,s).sort((r,d)=>-r.version.compare(d.version)).map(({value:r})=>c.structUtils.makeLocator(e,c.structUtils.makeRange({protocol:P,selector:r.tag_name,source:null,params:{...i,id:String(r.id)}})))}async getSatisfying(e,t,o,n){let p=c.semverUtils.validRange(c.structUtils.parseRange(e.range).selector);if(p===null)throw new Error(`Expected a valid range, got ${e.range}`);let i=c.miscUtils.mapAndFilter(o,s=>{if(s.identHash!==e.identHash)return c.miscUtils.mapAndFilter.skip;let r=c.structUtils.tryParseRange(s.reference,{requireProtocol:P});return!r||typeof r.params?.id!="string"?c.miscUtils.mapAndFilter.skip:{locator:s,version:new c.semverUtils.SemVer(r.selector)}});return{locators:W(p,i.map(({locator:s,version:r})=>({locator:s,tag_name:r.raw}))).sort((s,r)=>-s.version.compare(r.version)).map(({value:s})=>s.locator),sorted:!0}}async resolve(e,{project:t,fetchOptions:o}){let{params:n,selector:p}=c.structUtils.parseRange(e.reference),i=typeof n?.id=="string"?parseInt(n.id):null,l=await $(e,i,p,{project:t,cache:o?.cache}),s=new Map;if(typeof n?.binary=="string")s.set(w.ppath.basename(n.binary),"./bin-0.js");else if(n?.binary?.length)for(let[d,g]of n.binary.entries())s.set(w.ppath.basename(g),`./bin-${d}.js`);else s.set(e.name,"./bin-0.js");let r=I(e,l,Array.from(s.keys()),n);return{...e,version:l.tag_name,bin:s,dependencies:new Map(r.map(([,d])=>[d.identHash,d])),dependenciesMeta:new Map(r.map(([d])=>[d,new Map([[null,{optional:!0}]])])),conditions:void 0,languageName:"node",linkType:c.LinkType.HARD,peerDependencies:new Map,peerDependenciesMeta:new Map}}};function I(a,e,t,o){let n=[],p=new Map;for(let i of e.assets){let l=o?.strip_components;switch(i.content_type){case"application/gzip":if(!i.name.endsWith(".tar.gz"))continue;case"application/x-gtar":l=o?.strip_components_tar??l;break;case"application/zip":l=o?.strip_components_zip??l;break;default:continue}let s;if(/(?:\b|_)(?:apple|darwin)(?:\b|_)/i.test(i.name))s="darwin";else if(/(?:\b|_)(?:linux)(?:\b|_)/i.test(i.name))s="linux";else if(/(?:\b|_)(?:windows)(?:\b|_)/i.test(i.name))s="win32";else continue;let r;if(/(?:\b|_)(?:x86_64|x64|amd64)(?:\b|_)/.test(i.name))r="x64";else if(/(?:\b|_)(?:ia32|x86|i[3-9]86|386)(?:\b|_)/.test(i.name))r="ia32";else if(/(?:\b|_)(?:aarm64|aarch64)(?:\b|_)/.test(i.name))r="arm64";else if(/(?:\b|_)(?:arm|armhf|armv[6-9](hf)?)(?:\b|_)/.test(i.name))r="arm";else continue;let d=null;s==="linux"&&(/(?:\b|_)(?:musl)(?:\b|_)/.test(i.name)?d="musl":/(?:\b|_)(?:gnu|glibc)(?:\b|_)/.test(i.name)&&(d="glibc"),c.miscUtils.getSetWithDefault(p,r).add(d));let g=`@${a.scope}/${a.name}-${s}-${r}`;d&&(g+=`-${d}`);let b=c.structUtils.makeRange({protocol:k,selector:e.tag_name,source:null,params:{id:String(i.id),binary:t,platform:s,architecture:r,...d?{libc:d}:void 0,...l?{strip_components:l}:void 0}});n.push([g,c.structUtils.makeDescriptor(c.structUtils.parseIdent(g),b),s,r,d])}for(let[i,l]of p)if(l.size===1&&l.has("musl")){let s=n.find(d=>d[2]==="linux"&&d[3]===i&&d[4]==="musl"),r=c.structUtils.parseRange(s[1].range);delete r.params.libc,s[1]=c.structUtils.makeDescriptor(c.structUtils.makeIdent(s[1].scope,s[1].name.slice(0,-5)),c.structUtils.makeRange(r)),s[0]=c.structUtils.stringifyIdent(s[1])}return n}var D=class{supportsDescriptor(e){return e.range.startsWith(k)}supportsLocator(e){return e.reference.startsWith(k)}shouldPersistResolution(){return!0}bindDescriptor(e){return e}getResolutionDependencies(){return{}}async getCandidates(e){let t=c.structUtils.parseRange(e.range);return isFinite(parseInt(String(t.params.id)))?[c.structUtils.makeLocator(e,e.range)]:[]}async getSatisfying(e,t,o){return{locators:o.filter(n=>n.identHash===e.identHash&&n.reference===e.range),sorted:!0}}async resolve(e){let{params:t,selector:o}=c.structUtils.parseRange(e.reference),n=new Map([t.binary].flat().map(i=>[w.ppath.basename(i),`.${w.ppath.resolve(w.PortablePath.root,i)}`])),p=`os=${t.platform} & cpu=${t.architecture}`;return t.libc&&(p+=` & libc=${t.libc}`),{...e,version:o,bin:n,conditions:p,languageName:"node",linkType:c.LinkType.HARD,dependencies:new Map,dependenciesMeta:new Map,peerDependencies:new Map,peerDependenciesMeta:new Map}}};var pe=`#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import pkg from "./package.json" with {type: "json"};

let dependencyName = \`\${pkg.name}-\${process.platform}-\${process.arch}\`;

if (!pkg.optionalDependencies[dependencyName] && process.platform === "linux") {
	let header;
  try {
    header = fs.readFileSync("/usr/bin/ldd");
  } catch {}

  let libc;
  if (header) {
    if (header && (header.includes("GLIBC") || header.includes("GNU libc") || header.includes("GNU C Library")))
      libc = "glibc";
    if (header && header.includes("musl")) {
      libc = "musl";
    }
  }

  if (!libc) {
	  const report = process.report?.getReport() ?? {};
	  const sharedObjects = report.sharedObjects ?? [];

	  // Matches the first group if libc, second group if musl
	  const libcRegExp = /\\/(?:(ld-linux-|[^/]+-linux-gnu\\/)|(libc.musl-|ld-musl-))/;

		for (const entry of sharedObjects) {
	    const match = entry.match(libcRegExp);
	    if (!match) {
	     continue;
			}

	    if (match[1])
	      libc = "glibc";
	    if (match[2])
	      libc = "musl";

			break;
		}
  }

  if (!libc) {
  	process.stderr.write("Assertion failed: Expected the libc variant to have been detected\\n");
		process.exit(1);
  }

  dependencyName += \`-\${libc}\`;
}

if (!pkg.optionalDependencies[dependencyName]) {
	process.stderr.write("Unsupported platform\\n");
	process.exit(1);
}

const self = import.meta.filename;
let binaryName;
for (const [n, p] of Object.entries(pkg.bin)) {
	if (path.join(import.meta.dirname, p) === self) {
		binaryName = n;
	}
}

if (!binaryName) {
	console.error("Assertion Error: failed to find binary name\\n");
	process.exit(1);
}

const platformPkgUrl = import.meta.resolve(\`\${dependencyName}/package.json\`);
const {default: platformPkg} = await import(platformPkgUrl, {with: {type: "json"}});

const binaryPath = platformPkg?.bin?.[binaryName];
if (!binaryPath) {
	console.error("Assertion Error: failed to find binary path\\n");
	process.exit(1);
}

const resolvedBinaryPath = path.join(path.dirname(fileURLToPath(platformPkgUrl)), binaryPath);

execFileSync(resolvedBinaryPath, process.argv.slice(2), {
	stdio: 'inherit',
});
`,F=class{supports(e){return e.reference.startsWith(P)}getLocalPath(){return null}async fetch(e,t){let o=m.structUtils.parseRange(e.reference),{binary:n,id:p}=o.params,i=await $(e,parseInt(p),o.selector,{project:t.project,cache:t.cache}),l=await f.xfs.mktempPromise(),s=new f.JailFS(l),r=m.structUtils.getIdentVendorPath(e),d=m.structUtils.stringifyIdent(e),g=[n??e.name].flat();return await s.mkdirPromise(r,{recursive:!0}),await s.writeJsonPromise(`${r}/package.json`,{name:d,type:"module",bin:Object.fromEntries(g.map((b,y)=>[f.ppath.basename(b),`./bin-${y}.js`])),optionalDependencies:Object.fromEntries(I(e,i,g,o.params).map(([b,y])=>[b,y.range]))}),await Promise.all(Array.from(Array.isArray(n)?n:{length:1},(b,y)=>s.writeFilePromise(`${r}/bin-${y}.js`,pe))),{packageFs:s,prefixPath:r}}},O=class{supports(e){return e.reference.startsWith(k)}getLocalPath(){return null}async fetch(e,t){let o=t.checksums.get(e.locatorHash)||null,[n,p,i]=await t.cache.fetchPackageFromCache(e,o,{onHit:()=>t.report.reportCacheHit(e),onMiss:()=>t.report.reportCacheMiss(e,`${m.structUtils.prettyLocator(t.project.configuration,e)} can't be found in the cache and will be fetched from the remote registry`),loader:()=>this.#e(e,t),...t.cacheOptions});return{packageFs:n,releaseFs:p,prefixPath:m.structUtils.getIdentVendorPath(e),checksum:i}}async#e(e,t){let o=m.structUtils.parseRange(e.reference),{id:n,strip_components:p,binary:i,platform:l,architecture:s,libc:r}=o.params,d=r?`-${l}-${s}-${r}`:`-${l}-${s}`,g=m.structUtils.makeIdent(e.scope,e.name.slice(0,-d.length)),{content:b,content_type:y}=await S(g,parseInt(n),t),A=typeof p=="string"?parseInt(p):void 0,v=m.structUtils.getIdentVendorPath(e),M;switch(y){case"":case"application/gzip":case"application/x-gtar":M=await m.tgzUtils.convertToZip(b,{configuration:t.project.configuration,prefixPath:v,stripComponents:A});break;case"application/zip":let _=new E.ZipFS(b),x=f.PortablePath.root;if(A)for(let U=0;U<A;U++){let j=await _.readdirPromise(x);if(j.length!==1)throw new m.ReportError(m.MessageName.UNNAMED,`Invalid strip_components value ${A}, found ${j.length} entries in ${x} but expected to find 1`);x=f.ppath.join(x,j[0])}M=new E.ZipFS(null),await M.copyPromise(v,x,{baseFs:_,stableSort:!0,stableTime:!0}),_.discardAndClose();break;default:throw new Error(`Unexpected content type ${y}`)}let z=typeof l=="string"&&l==="win32"?".exe":"";return await M.writeJsonPromise(`${v}/package.json`,{name:m.structUtils.stringifyIdent(e),version:o.selector,preferUnplugged:!0,bin:Object.fromEntries([i].flat().map(_=>[f.ppath.basename(_),`.${f.ppath.resolve(f.PortablePath.root,_)}${z}`])),os:[l].flat(),cpu:[s].flat(),libc:r?[r].flat():void 0}),M}};var de={fetchers:[O,F],resolvers:[D,C]},me=de;return Y(ue);})();
return plugin;
}
};
