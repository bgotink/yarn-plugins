/* eslint-disable */
//prettier-ignore
module.exports = {
name: "@yarnpkg/plugin-github-release",
factory: function (require) {
"use strict";var plugin=(()=>{var G=Object.create;var x=Object.defineProperty;var V=Object.getOwnPropertyDescriptor;var K=Object.getOwnPropertyNames;var B=Object.getPrototypeOf,Z=Object.prototype.hasOwnProperty;var P=(a=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(a,{get:(e,t)=>(typeof require<"u"?require:e)[t]}):a)(function(a){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+a+'" is not supported')});var q=(a,e)=>{for(var t in e)x(a,t,{get:e[t],enumerable:!0})},H=(a,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of K(e))!Z.call(a,s)&&s!==t&&x(a,s,{get:()=>e[s],enumerable:!(n=V(e,s))||n.enumerable});return a};var X=(a,e,t)=>(t=a!=null?G(B(a)):{},H(e||!a||!a.__esModule?x(t,"default",{value:a,enumerable:!0}):t,a)),Y=a=>H(x({},"__esModule",{value:!0}),a);var ue={};q(ue,{default:()=>me});var m=P("@yarnpkg/core"),u=P("@yarnpkg/fslib"),j=P("@yarnpkg/libzip");var d=P("@yarnpkg/core"),g=P("@yarnpkg/fslib");var y="github-release:",R="github-release-asset:";var Q=new Map,ee=new Map;function te(a){return a.scope!==null?`@${a.scope}-${a.name}-${a.scope.length}`:a.name}async function ae(a,e){return await d.miscUtils.getFactoryWithDefault(Q,a.identHash,async()=>{try{return await g.xfs.readJsonPromise(e)}catch{return null}})}async function re(a,{configuration:e,cached:t,cachedPath:n}){return await d.miscUtils.getFactoryWithDefault(ee,a.identHash,async()=>{let s=[],i={accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10"},c=await le(e);c&&(i.authorization=c);let l=1;for(;;){let r=await d.httpUtils.request(`https://api.github.com/repos/${a.scope}/${a.name}/releases?page=${l}`,null,{method:d.httpUtils.Method.GET,configuration:e,jsonResponse:!0,headers:i}),f=r.body;if(t&&l===1&&t.lastModified===f[0].updated_at)return t;if(s.push(...r.body),![r.headers.link].flat().join("|").includes('rel="next"'))break;l++}let o={lastStoredAt:new Date().toISOString(),lastModified:s[0]?.updated_at,metadata:{releases:s.map(se)}};return Promise.resolve().then(async()=>{let r=`${n}-${process.pid}.tmp`;await g.xfs.mkdirPromise(g.ppath.dirname(r),{recursive:!0}),await g.xfs.writeJsonPromise(r,o,{compact:!0}),await g.xfs.renamePromise(r,n)}).catch(()=>{}),o})}async function I(a,{project:e}){let{configuration:t}=e,n=g.ppath.join(ce(t),te(a)),s=null;return e.lockfileNeedsRefresh||(s=await ae(a,n)),(await re(a,{configuration:t,cached:s,cachedPath:n})).metadata}async function L(a,e,t,{project:n}){let{releases:s}=await I(a,{project:n}),i=e?s.find(c=>c.id===e):s.find(c=>c.tag_name===t);if(!i)throw new Error(`Unable to find release ${t} (id: ${e})`);return i}async function S(a,e,{project:t}){let{browser_download_url:n,content_type:s}=await d.httpUtils.get(`https://api.github.com/repos/${a.scope}/${a.name}/releases/assets/${e}`,{configuration:t.configuration,jsonResponse:!0});return{content:await d.httpUtils.get(n,{configuration:t.configuration,jsonResponse:!1}),content_type:s}}var ne=["name","tag_name","id","created_at","updated_at","assets[].name","assets[].id","assets[].content_type"];function se({assets:a,created_at:e,id:t,name:n,tag_name:s,updated_at:i}){return{assets:a.map(oe),created_at:e,id:t,name:n,tag_name:s,updated_at:i}}function oe({id:a,name:e,content_type:t}){return{id:a,name:e,content_type:t}}var ie=d.hashUtils.makeHash("time",...ne).slice(0,6);function ce(a){return g.ppath.join(a.get("globalFolder"),`metadata/github.com-releases/${ie}`)}async function le(a){return null}function $(a,e,t){let n=[],s=new Map;for(let i of e.assets){let c=t?.strip_components;switch(i.content_type){case"application/gzip":if(!i.name.endsWith(".tar.gz"))continue;case"application/x-gtar":c=t?.strip_components_tar??c;break;case"application/zip":c=t?.strip_components_zip??c;break;default:continue}let l;if(/(?:\b|_)(?:apple|darwin)(?:\b|_)/i.test(i.name))l="darwin";else if(/(?:\b|_)(?:linux)(?:\b|_)/i.test(i.name))l="linux";else if(/(?:\b|_)(?:windows)(?:\b|_)/i.test(i.name))l="win32";else continue;let o;if(/(?:\b|_)(?:x86_64|x64|amd64)(?:\b|_)/.test(i.name))o="x64";else if(/(?:\b|_)(?:ia32|x86|i[3-9]86|386)(?:\b|_)/.test(i.name))o="ia32";else if(/(?:\b|_)(?:arm64|aarch64)(?:\b|_)/.test(i.name))o="arm64";else if(/(?:\b|_)(?:arm|armhf|armv[6-9](hf)?)(?:\b|_)/.test(i.name))o="arm";else continue;let r=null;l==="linux"&&(/(?:\b|_)(?:musl)(?:\b|_)/.test(i.name)?r="musl":/(?:\b|_)(?:gnu|glibc)(?:\b|_)/.test(i.name)&&(r="glibc"),d.miscUtils.getSetWithDefault(s,o).add(r));let f=`@${a.scope}/${a.name}-${l}-${o}`;r&&(f+=`-${r}`);let h=d.structUtils.makeRange({protocol:R,selector:e.tag_name,source:null,params:{id:String(i.id),binary:t.binary??a.name,platform:l,architecture:o,...r?{libc:r}:void 0,...c?{strip_components:c}:void 0}});n.push([f,d.structUtils.makeDescriptor(d.structUtils.parseIdent(f),h),l,o,r])}for(let[i,c]of s)if(c.size===1&&c.has("musl")){let l=n.find(r=>r[2]==="linux"&&r[3]===i&&r[4]==="musl"),o=d.structUtils.parseRange(l[1].range);delete o.params.libc,l[1]=d.structUtils.makeDescriptor(d.structUtils.makeIdent(l[1].scope,l[1].name.slice(0,-5)),d.structUtils.makeRange(o)),l[0]=d.structUtils.stringifyIdent(l[1])}return n}var pe=`#!/usr/bin/env node
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
`,D=class{supports(e){return e.reference.startsWith(y)}getLocalPath(){return null}async fetch(e,t){let n=m.structUtils.parseRange(e.reference),{binary:s,id:i}=n.params,c=await L(e,parseInt(i),n.selector,t),l=await u.xfs.mktempPromise(),o=new u.JailFS(l),r=m.structUtils.getIdentVendorPath(e),f=m.structUtils.stringifyIdent(e);return await o.mkdirPromise(r,{recursive:!0}),await o.writeJsonPromise(`${r}/package.json`,{name:f,type:"module",bin:Object.fromEntries([s??e.name].flat().map((h,b)=>[u.ppath.basename(h),`./bin-${b}.js`])),optionalDependencies:Object.fromEntries($(e,c,n.params).map(([h,b])=>[h,b.range]))}),await Promise.all(Array.from(Array.isArray(s)?s:{length:1},(h,b)=>o.writeFilePromise(`${r}/bin-${b}.js`,pe))),{packageFs:o,prefixPath:r,checksum:null}}},O=class{supports(e){return e.reference.startsWith(R)}getLocalPath(){return null}async fetch(e,t){let n=t.checksums.get(e.locatorHash)||null,[s,i,c]=await t.cache.fetchPackageFromCache(e,n,{onHit:()=>t.report.reportCacheHit(e),onMiss:()=>t.report.reportCacheMiss(e,`${m.structUtils.prettyLocator(t.project.configuration,e)} can't be found in the cache and will be fetched from the remote registry`),loader:()=>this.#e(e,t),...t.cacheOptions});return{packageFs:s,releaseFs:i,prefixPath:m.structUtils.getIdentVendorPath(e),checksum:c}}async#e(e,t){let n=m.structUtils.parseRange(e.reference),{id:s,strip_components:i,binary:c,platform:l,architecture:o,libc:r}=n.params,f=r?`-${l}-${o}-${r}`:`-${l}-${o}`,h=m.structUtils.makeIdent(e.scope,e.name.slice(0,-f.length)),{content:b,content_type:E}=await S(h,parseInt(s),t),A=typeof i=="string"?parseInt(i):void 0,C=m.structUtils.getIdentVendorPath(e),k;switch(E){case"":case"application/gzip":case"application/x-gtar":k=await m.tgzUtils.convertToZip(b,{configuration:t.project.configuration,prefixPath:C,stripComponents:A});break;case"application/zip":let w=new j.ZipFS(b),M=u.PortablePath.root;if(A)for(let U=0;U<A;U++){let N=await w.readdirPromise(M);if(N.length!==1)throw new m.ReportError(m.MessageName.UNNAMED,`Invalid strip_components value ${A}, found ${N.length} entries in ${M} but expected to find 1`);M=u.ppath.join(M,N[0])}k=new j.ZipFS(null),await k.copyPromise(C,M,{baseFs:w,stableSort:!0,stableTime:!0}),w.discardAndClose();break;default:throw new Error(`Unexpected content type ${E}`)}let z=typeof l=="string"&&l==="win32"?".exe":"";return await k.writeJsonPromise(`${C}/package.json`,{name:m.structUtils.stringifyIdent(e),version:n.selector,preferUnplugged:!0,bin:Object.fromEntries([c].flat().map(w=>[u.ppath.basename(w),`.${u.ppath.resolve(u.PortablePath.root,w)}${z}`])),os:[l].flat(),cpu:[o].flat(),libc:r?[r].flat():void 0}),k}};var p=P("@yarnpkg/core"),W=X(P("semver"));var _=P("@yarnpkg/fslib");function J(a,e){return p.miscUtils.mapAndFilter(e,t=>{try{let n=new p.semverUtils.SemVer(t.tag_name);if(a.test(n))return{value:t,version:n}}catch{}return p.miscUtils.mapAndFilter.skip})}var F=class{supportsDescriptor(e){if(e.scope==null||!e.range.startsWith(y))return!1;let{selector:t}=p.structUtils.parseRange(e.range);return!!p.semverUtils.validRange(t)}supportsLocator(e){if(e.scope==null||!e.reference.startsWith(y))return!1;let{selector:t,params:n}=p.structUtils.parseRange(e.reference);return!(!W.valid(t)||typeof n?.id!="string")}shouldPersistResolution(){return!0}bindDescriptor(e){return e}getResolutionDependencies(){return{}}async getCandidates(e,t,n){let{selector:s,params:i}=p.structUtils.parseRange(e.range),c=p.semverUtils.validRange(s);if(c===null)throw new Error(`Expected a valid range, got ${s}`);let{releases:l}=await I(e,n);return J(c,l).sort((o,r)=>-o.version.compare(r.version)).map(({value:o})=>p.structUtils.makeLocator(e,p.structUtils.makeRange({protocol:y,selector:o.tag_name,source:null,params:{...i,id:String(o.id)}})))}async getSatisfying(e,t,n,s){let i=p.semverUtils.validRange(p.structUtils.parseRange(e.range).selector);if(i===null)throw new Error(`Expected a valid range, got ${e.range}`);let c=p.miscUtils.mapAndFilter(n,o=>{if(o.identHash!==e.identHash)return p.miscUtils.mapAndFilter.skip;let r=p.structUtils.tryParseRange(o.reference,{requireProtocol:y});return!r||typeof r.params?.id!="string"?p.miscUtils.mapAndFilter.skip:{locator:o,version:new p.semverUtils.SemVer(r.selector)}});return{locators:J(i,c.map(({locator:o,version:r})=>({locator:o,tag_name:r.raw}))).sort((o,r)=>-o.version.compare(r.version)).map(({value:o})=>o.locator),sorted:!0}}async resolve(e,t){let{params:n,selector:s}=p.structUtils.parseRange(e.reference),i=typeof n?.id=="string"?parseInt(n.id):null,c=await L(e,i,s,t),l=new Map([n?.binary??e.name].flat().map((r,f)=>[_.ppath.basename(r),`./bin-${f}.js`])),o=$(e,c,n);return{...e,version:c.tag_name,bin:l,dependencies:new Map(o.map(([,r])=>[r.identHash,r])),dependenciesMeta:new Map(o.map(([r])=>[r,new Map([[null,{optional:!0}]])])),conditions:void 0,languageName:"node",linkType:p.LinkType.HARD,peerDependencies:new Map,peerDependenciesMeta:new Map}}},v=class{supportsDescriptor(e){return e.range.startsWith(R)}supportsLocator(e){return e.reference.startsWith(R)}shouldPersistResolution(){return!0}bindDescriptor(e){return e}getResolutionDependencies(){return{}}async getCandidates(e){let t=p.structUtils.parseRange(e.range);return isFinite(parseInt(String(t.params.id)))?[p.structUtils.makeLocator(e,e.range)]:[]}async getSatisfying(e,t,n){return{locators:n.filter(s=>s.identHash===e.identHash&&s.reference===e.range),sorted:!0}}async resolve(e){let{params:t,selector:n}=p.structUtils.parseRange(e.reference),s=new Map([t.binary].flat().map(c=>[_.ppath.basename(c),`.${_.ppath.resolve(_.PortablePath.root,c)}`])),i=`os=${t.platform} & cpu=${t.architecture}`;return t.libc&&(i+=` & libc=${t.libc}`),{...e,version:n,bin:s,conditions:i,languageName:"node",linkType:p.LinkType.HARD,dependencies:new Map,dependenciesMeta:new Map,peerDependencies:new Map,peerDependenciesMeta:new Map}}};var de={fetchers:[O,D],resolvers:[v,F]},me=de;return Y(ue);})();
return plugin;
}
};
