# plastiq-loader

A magic asynchronous loader thingy for plastiq.

# magic?

Ok, fair enough. This is better described with an example. Let's say you have a page with a search box, and you want to load the results as you type. You want to make an AJAX GET request to fetch the results and display them in your DOM. Each time the user types a new character, you want to get some new results. Conversely, each time the user _doesn't_ type a new character, you _don't_ want to load search results, which sounds pretty obvious. What `plastiq-loader` can do is allow you to get the search results on each new render, but only if the search query has changed. This is much easier than attaching event handlers to the search box.

```js
var plastiq = require('plastiq');
var h = plastiq.html;
var loader = require('plastiq-loader');
var $ = require('jquery');

var searchResults = loader(function (query) {
  if (query) {
    return $.get('/search?q=' + encodeURIComponent(query));
  }
});

function render(model) {
  var results = searchResults(model.query);

  return h('div',
    h('label', 'Search', h('input', {type: 'text', binding: [model, 'query']})),
    results && model.query
      ? h('ol',
          results.map(function (result) {
            return h('li', result);
          })
        )
      : h('loading...')
  );
}

plastiq.append(document.body, render, {});
```

The first time `searchResults` is called, it will start loading the results and return `undefined`. As soon as results come in plastiq will refresh and `searchResults` will be called again, this time returning the results. As the search query changes, the new results will arrive and the page will be refreshed.

# routes

Another example is when you have client-side routes. Let's say, for example, that you have a blog engine and each blog entry is on its own route, naturally. Each time you get to a new blog URL, you want to load the corresponding blog entry. With `plastiq-loader` you can load the blog entry in the render function, and it will do the magic of only loading a new blog entry when the URL changes. In this case you may want to use `{timeout: 0}` to ensure that when the URL changes, you get a "loading" page instead of the previous page.

```js
var plastiq = require('plastiq');
var h = plastiq.html;
var loader = require('plastiq-loader');
var $ = require('jquery');
var router = require('plastiq-router');

var postRoute = router.route('/post/:id');
var rootRoute = router.route('/');

var loadPost = loader(function (id) {
  return $.get('/api/post/' + encodeURIComponent(query));
}, {timeout: 0});

function render(model) {
  return h('div',
    rootRoute(function () {
      return h('h1', 'welcome to my blog!');
    }),
    postRoute(function (params) {
      var post = loadPost(params.id);
      
      if (post) {
        return h('.post',
          h('h1', post.title)
          h('article', post.body)
        );
      } else {
        return h('h1', 'loading...');
      }
    })
  );
}

plastiq.append(document.body, render, {});
```

# api

```js
var loader = require('plastiq-loader');

var loaderFn = loader(fn, [options]);
```

* `fn` - a function that returns a resource, or a promise of a resource. This is only called if the arguments passed to `loaderFn` are different to the last arguments passed.
* `loaderFn` - a function that returns either `undefined` if the promise returned from `fn` is still pending, or the fulfilled value of the promise when it has been fulfilled. If the promise is rejected with an error, then `loaderFn` will throw that error.
* `options.timeout` - `loaderFn` will continue to return the previous value even when new arguments are passed to it, however if the promise returned from `fn` takes more than `timeout` then `loaderFn` will start returning `undefined` again. Default is 140ms. Set this to 0 to return `undefined` as soon as the arguments have changed.
* `options.onfulfilled` - a function to be called when the promise returned from `fn` is fulfilled. By default refreshes the plastiq view.
* `options.equality` - Default argument equality is by reference, set this to `json` if you want to compare arguments by comparing the JSON representation of the arguments.
