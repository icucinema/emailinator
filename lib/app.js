/**
 *
 * Emailinator
 * Copyright 2017 Luke Granger-Brown. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 *
 */

"use strict";

import fs from 'fs'
import path from 'path'

import express from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import pug from 'pug'
import nodemailer from 'nodemailer'
import moment from 'moment'
import { mjml2html } from 'mjml'

moment.locale('en-gb')

import { DjangoJSONSigner } from './djangosigner'

const port = process.env.PORT || 3000

const mailTransport = nodemailer.createTransport({
  host: 'smarthost.cc.ic.ac.uk',
  port: 25,
  logger: true,
  disableFileAccess: true,
  disableUrlAccess: true,
})

const app = express()
app.set('view engine', 'pug')
app.use(cookieParser())
app.use(bodyParser.json())
app.use('/static/dist', express.static('dist/static'))
app.use('/static', express.static('static'))

if (process.env.SSO_SECRET) {
  // configure cinema SSO
  const ssoConfig = {
    secret: process.env.SSO_SECRET,
    cookieName: 'icuc_auth',
    loginURL: 'https://staff.icucinema.co.uk/user/sso/',
    maxAge: null,
  }

  app.use((req, res, next) => {
    const redirectURI = ssoConfig.loginURL + '?next=' + encodeURIComponent(`https://${req.hostname}${req.originalUrl}`)

    const ssoCookie = '"' + req.cookies[ssoConfig.cookieName] + '"'
    if (!ssoCookie) {
      res.redirect(redirectURI)
      return
    }
    try {
      const signer = new DjangoJSONSigner(ssoConfig.secret, ssoConfig.cookieName)
      const data = signer.unsign(ssoCookie)
      req.user = data
    } catch (e) {
      res.redirect(redirectURI)
      return
    }
    next()
  })
} else {
  app.use((req, res, next) => {
    req.user = {
      username: 'debug',
      first_name: 'Debug',
      last_name: 'User',
      name: 'Debug User',
    }
    next()
  })
}

app.get('/', (req, res) => {
  res.render('index', {'title': ''})
})

app.get('/films', (req, res) => {
  fetch('https://www.imperialcinema.co.uk/films/api/email.json')
    .then((fetchRes) => fetchRes.text())
    .then((fetchText) => res.type('json').send(fetchText))
    .catch((e) => res.status(500).send(e.toString()))
})

const TEMPLATE_SUFFIX = '.mjml.pug'
const ALLOWED_TEMPLATE_REGEX = /^[a-zA-Z0-9_]+$/
app.get('/template', (req, res) => {
  fs.readdir('mjmltemplates', (err, files) => {
    const templates = files
      .filter((f) => f.substring(f.length - TEMPLATE_SUFFIX.length) === TEMPLATE_SUFFIX)
      .map((f) => f.substring(0, f.length - TEMPLATE_SUFFIX.length))
      .filter((f) => !!f.match(ALLOWED_TEMPLATE_REGEX))

    res.json({ templates: templates })
  })
})

app.get('/template/:name', (req, res) => {
  if (!req.params.name.match(ALLOWED_TEMPLATE_REGEX)) {
    res.status(400).send('template name invalid')
    return
  }
  fs.readFile(path.join('mjmltemplates', `${req.params.name}.mjml.pug`), (err, data) => {
    if (err) return res.type('text/plain').status(500).send(err.toString())
    try {
      const compiled = pug.compileClient(data, {doctype: 'xml'})
      res.type('application/javascript').send(compiled)
    } catch (e) {
      res.type('text/plain').status(500).send(e.toString())
    }
  })
})

app.post('/send', (req, res) => {
  const body = {}
  Object.assign(body, req.body)
  Object.assign(body, {
    moment: moment,
  })
  if (!body.template.match(ALLOWED_TEMPLATE_REGEX)) {
    res.status(400).send('template name invalid')
    return
  }
  const tmpl = pug.compileFile(path.join('mjmltemplates', `${body.template}.mjml.pug`), {doctype: 'xml'})
  const html = mjml2html(tmpl(body))
  const message = {
    from: 'cinema@imperial.ac.uk',
    to: 'cinema-list@imperial.ac.uk',
    subject: body.subject,
    text: html, // sorry :(
    html: html,
    replyTo: 'cinema@imperial.ac.uk',
  }
  mailTransport.sendMail(message, (err, info) => {
    if (err) {
      console.error(err)
      res.status(500).send(err)
      return
    }
    res.json(info)
  })
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
