# オンラインシューティングゲーム

https://online-shooting.herokuapp.com

## Development

### Server 1

After cloning:

```
$ npm install
```

When starting:

```
$ PORT=8000 npm start
```

### Server 2

```
$ npm run watch
```

## Deployment

```
$ heroku create
$ heroku config:set HOST="<YOUR HOST>"
$ git push heroku master
```
