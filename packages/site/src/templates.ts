/**
 * Embedded EJS template strings for static site generation.
 * Templates are embedded rather than loaded from .ejs files to avoid
 * runtime file resolution issues when the package is bundled by tsup.
 */

export const layoutTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= pageTitle %> - <%= project.displayName %></title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="<%= basePath %>/style.css">
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
  <nav class="bg-white border-b border-gray-200 px-6 py-3">
    <div class="max-w-6xl mx-auto flex items-center gap-6">
      <a href="<%= basePath %>/" class="font-bold text-lg text-blue-600"><%= project.displayName %></a>
      <div class="flex gap-4 text-sm">
        <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a>
        <a href="<%= basePath %>/glossary.html" class="hover:text-blue-600">Glossary</a>
        <a href="<%= basePath %>/search.html" class="hover:text-blue-600">Search</a>
      </div>
    </div>
  </nav>
  <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
    <%- content %>
  </main>
  <footer class="bg-white border-t border-gray-200 px-6 py-4 text-center text-sm text-gray-500">
    Built with <a href="https://github.com/contextkit" class="text-blue-600 hover:underline">ContextKit</a> &middot; <%= build.timestamp %>
  </footer>
</body>
</html>`;

export const indexTemplate = `<h1 class="text-3xl font-bold mb-2"><%= project.displayName %></h1>
<p class="text-gray-600 mb-6">Version <%= project.version %></p>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <div class="text-2xl font-bold text-blue-600"><%= concepts.length %></div>
    <div class="text-sm text-gray-500">Concepts</div>
  </div>
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <div class="text-2xl font-bold text-green-600"><%= products.length %></div>
    <div class="text-sm text-gray-500">Products</div>
  </div>
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <div class="text-2xl font-bold text-purple-600"><%= policies.length %></div>
    <div class="text-sm text-gray-500">Policies</div>
  </div>
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <div class="text-2xl font-bold text-orange-600"><%= entities.length %></div>
    <div class="text-sm text-gray-500">Entities</div>
  </div>
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <div class="text-2xl font-bold text-teal-600"><%= terms.length %></div>
    <div class="text-sm text-gray-500">Terms</div>
  </div>
  <div class="bg-white rounded-lg shadow p-4 text-center">
    <div class="text-2xl font-bold text-red-600"><%= owners.length %></div>
    <div class="text-sm text-gray-500">Owners</div>
  </div>
</div>

<% if (concepts.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Concepts</h2>
<ul class="mb-6 space-y-1">
  <% concepts.forEach(function(c) { %>
  <li><a href="<%= basePath %>/concepts/<%= c.id %>.html" class="text-blue-600 hover:underline"><%= c.id %></a>
    <% if (c.certified) { %><span class="ml-1 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">certified</span><% } %>
  </li>
  <% }); %>
</ul>
<% } %>

<% if (products.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Products</h2>
<ul class="mb-6 space-y-1">
  <% products.forEach(function(p) { %>
  <li><a href="<%= basePath %>/products/<%= p.id %>.html" class="text-blue-600 hover:underline"><%= p.id %></a></li>
  <% }); %>
</ul>
<% } %>

<% if (policies.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Policies</h2>
<ul class="mb-6 space-y-1">
  <% policies.forEach(function(p) { %>
  <li><a href="<%= basePath %>/policies/<%= p.id %>.html" class="text-blue-600 hover:underline"><%= p.id %></a></li>
  <% }); %>
</ul>
<% } %>

<% if (owners.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Owners</h2>
<ul class="mb-6 space-y-1">
  <% owners.forEach(function(o) { %>
  <li><a href="<%= basePath %>/owners/<%= o.id %>.html" class="text-blue-600 hover:underline"><%= o.displayName %></a></li>
  <% }); %>
</ul>
<% } %>`;

export const conceptTemplate = `<nav class="text-sm text-gray-500 mb-4">
  <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a> &rsaquo; Concepts &rsaquo; <%= concept.id %>
</nav>

<h1 class="text-3xl font-bold mb-2"><%= concept.id %>
  <% if (concept.certified) { %><span class="ml-2 text-sm bg-green-100 text-green-800 px-2 py-0.5 rounded">certified</span><% } %>
</h1>

<p class="text-lg text-gray-700 mb-6"><%= concept.definition %></p>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
  <% if (concept.owner) { %>
  <div class="bg-white rounded-lg shadow p-4">
    <div class="text-sm text-gray-500">Owner</div>
    <a href="<%= basePath %>/owners/<%= concept.owner %>.html" class="text-blue-600 hover:underline"><%= concept.owner %></a>
  </div>
  <% } %>
  <% if (concept.productId) { %>
  <div class="bg-white rounded-lg shadow p-4">
    <div class="text-sm text-gray-500">Product</div>
    <a href="<%= basePath %>/products/<%= concept.productId %>.html" class="text-blue-600 hover:underline"><%= concept.productId %></a>
  </div>
  <% } %>
</div>

<% if (concept.tags && concept.tags.length > 0) { %>
<div class="mb-4">
  <span class="text-sm text-gray-500 mr-2">Tags:</span>
  <% concept.tags.forEach(function(tag) { %>
  <span class="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1"><%= tag %></span>
  <% }); %>
</div>
<% } %>

<% if (concept.dependsOn && concept.dependsOn.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Dependencies</h2>
<ul class="mb-6 space-y-1">
  <% concept.dependsOn.forEach(function(dep) { %>
  <li><a href="<%= basePath %>/concepts/<%= dep %>.html" class="text-blue-600 hover:underline"><%= dep %></a></li>
  <% }); %>
</ul>
<% } %>`;

export const productTemplate = `<nav class="text-sm text-gray-500 mb-4">
  <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a> &rsaquo; Products &rsaquo; <%= product.id %>
</nav>

<h1 class="text-3xl font-bold mb-2"><%= product.id %></h1>
<p class="text-lg text-gray-700 mb-6"><%= product.description %></p>

<% if (product.owner) { %>
<div class="mb-4">
  <span class="text-sm text-gray-500 mr-2">Owner:</span>
  <a href="<%= basePath %>/owners/<%= product.owner %>.html" class="text-blue-600 hover:underline"><%= product.owner %></a>
</div>
<% } %>

<% if (product.tags && product.tags.length > 0) { %>
<div class="mb-4">
  <span class="text-sm text-gray-500 mr-2">Tags:</span>
  <% product.tags.forEach(function(tag) { %>
  <span class="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1"><%= tag %></span>
  <% }); %>
</div>
<% } %>

<% if (relatedConcepts.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Concepts</h2>
<ul class="mb-6 space-y-1">
  <% relatedConcepts.forEach(function(c) { %>
  <li><a href="<%= basePath %>/concepts/<%= c.id %>.html" class="text-blue-600 hover:underline"><%= c.id %></a> &mdash; <%= c.definition %></li>
  <% }); %>
</ul>
<% } %>`;

export const policyTemplate = `<nav class="text-sm text-gray-500 mb-4">
  <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a> &rsaquo; Policies &rsaquo; <%= policy.id %>
</nav>

<h1 class="text-3xl font-bold mb-2"><%= policy.id %></h1>
<p class="text-lg text-gray-700 mb-6"><%= policy.description %></p>

<% if (policy.owner) { %>
<div class="mb-4">
  <span class="text-sm text-gray-500 mr-2">Owner:</span>
  <a href="<%= basePath %>/owners/<%= policy.owner %>.html" class="text-blue-600 hover:underline"><%= policy.owner %></a>
</div>
<% } %>

<% if (policy.tags && policy.tags.length > 0) { %>
<div class="mb-4">
  <span class="text-sm text-gray-500 mr-2">Tags:</span>
  <% policy.tags.forEach(function(tag) { %>
  <span class="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1"><%= tag %></span>
  <% }); %>
</div>
<% } %>

<% if (policy.rules && policy.rules.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Rules</h2>
<div class="overflow-x-auto">
  <table class="min-w-full bg-white rounded-lg shadow text-sm">
    <thead>
      <tr class="bg-gray-50 text-left">
        <th class="px-4 py-2">Priority</th>
        <th class="px-4 py-2">When</th>
        <th class="px-4 py-2">Then</th>
      </tr>
    </thead>
    <tbody>
      <% policy.rules.forEach(function(rule) { %>
      <tr class="border-t">
        <td class="px-4 py-2"><%= rule.priority %></td>
        <td class="px-4 py-2">
          <% if (rule.when.tagsAny) { %>tags: <%= rule.when.tagsAny.join(', ') %><% } %>
          <% if (rule.when.conceptIds) { %>concepts: <%= rule.when.conceptIds.join(', ') %><% } %>
          <% if (rule.when.status) { %>status: <%= rule.when.status %><% } %>
        </td>
        <td class="px-4 py-2">
          <% if (rule.then.requireRole) { %>require role: <%= rule.then.requireRole %><% } %>
          <% if (rule.then.deny) { %>deny<% } %>
          <% if (rule.then.warn) { %>warn: <%= rule.then.warn %><% } %>
        </td>
      </tr>
      <% }); %>
    </tbody>
  </table>
</div>
<% } %>`;

export const ownerTemplate = `<nav class="text-sm text-gray-500 mb-4">
  <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a> &rsaquo; Owners &rsaquo; <%= owner.id %>
</nav>

<h1 class="text-3xl font-bold mb-2"><%= owner.displayName %></h1>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  <div class="bg-white rounded-lg shadow p-4">
    <div class="text-sm text-gray-500">ID</div>
    <div><%= owner.id %></div>
  </div>
  <% if (owner.email) { %>
  <div class="bg-white rounded-lg shadow p-4">
    <div class="text-sm text-gray-500">Email</div>
    <div><a href="mailto:<%= owner.email %>" class="text-blue-600 hover:underline"><%= owner.email %></a></div>
  </div>
  <% } %>
  <% if (owner.team) { %>
  <div class="bg-white rounded-lg shadow p-4">
    <div class="text-sm text-gray-500">Team</div>
    <div><%= owner.team %></div>
  </div>
  <% } %>
</div>

<% if (ownedNodes.length > 0) { %>
<h2 class="text-xl font-semibold mb-3">Owned Nodes</h2>
<ul class="space-y-1">
  <% ownedNodes.forEach(function(node) { %>
  <li>
    <span class="inline-block bg-gray-100 text-xs px-1.5 py-0.5 rounded mr-1"><%= node.kind %></span>
    <a href="<%= node.href %>" class="text-blue-600 hover:underline"><%= node.id %></a>
  </li>
  <% }); %>
</ul>
<% } %>`;

export const glossaryTemplate = `<nav class="text-sm text-gray-500 mb-4">
  <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a> &rsaquo; Glossary
</nav>

<h1 class="text-3xl font-bold mb-6">Glossary</h1>

<% if (terms.length === 0) { %>
<p class="text-gray-500">No terms defined.</p>
<% } else { %>
<div class="overflow-x-auto">
  <table class="min-w-full bg-white rounded-lg shadow text-sm">
    <thead>
      <tr class="bg-gray-50 text-left">
        <th class="px-4 py-2">Term</th>
        <th class="px-4 py-2">Definition</th>
        <th class="px-4 py-2">Synonyms</th>
        <th class="px-4 py-2">Maps To</th>
      </tr>
    </thead>
    <tbody>
      <% terms.forEach(function(term) { %>
      <tr class="border-t">
        <td class="px-4 py-2 font-medium"><%= term.id %></td>
        <td class="px-4 py-2"><%= term.definition %></td>
        <td class="px-4 py-2"><%= (term.synonyms || []).join(', ') %></td>
        <td class="px-4 py-2">
          <% (term.mapsTo || []).forEach(function(target) { %>
          <a href="<%= basePath %>/concepts/<%= target %>.html" class="text-blue-600 hover:underline"><%= target %></a><%= ' ' %>
          <% }); %>
        </td>
      </tr>
      <% }); %>
    </tbody>
  </table>
</div>
<% } %>`;

export const searchTemplate = `<nav class="text-sm text-gray-500 mb-4">
  <a href="<%= basePath %>/" class="hover:text-blue-600">Home</a> &rsaquo; Search
</nav>

<h1 class="text-3xl font-bold mb-6">Search</h1>

<input
  id="search-input"
  type="text"
  placeholder="Search concepts, products, policies, terms..."
  class="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
>

<div id="search-results" class="space-y-3"></div>

<script>window.__CONTEXTKIT_BASE_PATH__ = '<%= basePath %>';</script>
<script src="<%= basePath %>/search.js"></script>`;
