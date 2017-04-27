import React from 'react'
import ReactDOM from 'react-dom'

import injectTapEventPlugin from 'react-tap-event-plugin'

import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import AppBar from 'material-ui/AppBar'
import SelectField from 'material-ui/SelectField'
import MenuItem from 'material-ui/MenuItem'
import TextField from 'material-ui/TextField'
import RaisedButton from 'material-ui/RaisedButton'
import FontIcon from 'material-ui/FontIcon'

import { mjml2html } from 'mjml'
import moment from 'moment'
import showdown from 'showdown'

injectTapEventPlugin()
moment.locale('en-GB')

const checkRespOK = (resp) => {
  if (resp.status !== 200)
    throw new Error(`Server status was ${resp.status} ${resp.statusText}`)
  return resp
}

class MJMLIframe extends React.Component {
  render() {
    if (!this.props.mjml) return (<h3>Loading...</h3>)
    try {
      const output = mjml2html(this.props.mjml)
      return (
        <iframe srcDoc={output.html} className="full-size-iframe" sandbox="" />
      )
    } catch (e) {
      return (
        <h3 className="mjml-error">{e.toString()}</h3>
      )
    }
  }
}

class MailForm extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      headText: props.headText,
      template: props.template,
      templates: props.templates,
      subject: props.subject,
    }
    this.converter = new showdown.Converter()

    this.handleChangeTemplate = this.handleChangeTemplate.bind(this)
    this.handleChangeText = this.handleChangeText.bind(this)
    this.handleChangeSubject = this.handleChangeSubject.bind(this)
  }

  onChange(override) {
    const state = {}
    Object.assign(state, this.state)
    if (override) Object.assign(state, override)

    this.props.onChange({
      headHTML: this.converter.makeHtml(state.headText),
      template: state.template,
      subject: state.subject,
    })
  }

  componentDidMount() {
    this.onChange()
  }

  handleChangeTemplate(event, index, value) {
    this.setState({template: value})
    this.onChange({template: value})
  }

  handleChangeText(event, value) {
    this.setState({headText: value})

    if (this.debounceChange) {
      clearTimeout(this.debounceChange)
    }
    this.debounceChange = setTimeout(() => {
      this.onChange({headText: value})
      this.debounceChange = null
    }, 200)
  }

  handleChangeSubject(event, value) {
    this.setState({subject: value})
    this.onChange({subject: value})
  }

  render() {
    return (
      <div>
        <SelectField floatingLabelText="Template" value={this.state.template} onChange={this.handleChangeTemplate}>
          {this.state.templates.map((t) => (
            <MenuItem value={t} key={t} primaryText={t} />
          ))}
        </SelectField>
        <TextField fullWidth={true} value={this.state.subject} onChange={this.handleChangeSubject} floatingLabelText="Subject" id="form-subject" />
        <TextField multiLine={true} fullWidth={true} value={this.state.headText} onChange={this.handleChangeText} floatingLabelText="Blurb" id="form-blurb" />
        <br />
        <br />
        <RaisedButton label="Send" primary={true} icon={<FontIcon className="material-icons">email</FontIcon>} fullWidth={true} disabled={this.disableSubmit()} onTouchTap={this.props.onSubmit} />
      </div>
    )
  }

  disableSubmit() {
    if (this.props.disableSubmit) return true
    if (this.state.headText.indexOf('Cinema Meddler') !== -1) return true
    if (this.state.headText.indexOf('This Heading is the Best') !== -1) return true
    return false
  }
}

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      renderMJML: () => '',
      films: [],
      template: 'weekly',
      loading: true,
      headText: `# This Heading is the Best
      
I love to separate my paragraphs with two line breaks.
  
And including [links](https://www.imperialcinema.co.uk) is easy too!
  
\\- Luke, Cinema Meddler 16/17`,
      headHTML: '',
      subject: '',
      sendDisabled: false,
    }
    this.handleFormChange = this.handleFormChange.bind(this)
    this.handleFormSubmit = this.handleFormSubmit.bind(this)
  }

  refreshTemplates() {
    return (window.fetch('/template', { credentials: 'include' })
      .then(checkRespOK)
      .then((resp) => resp.json())
      .then((respJSON) => this.setState({ templates: respJSON.templates })))
  }

  refreshTemplate(templateName) {
    this.setState({loadingTemplate: templateName})
    return (window.fetch(`/template/${templateName}`, { credentials: 'include' })
      .then(checkRespOK)
      .then((resp) => resp.text())
      .then((tplJS) => {
        const template = eval('(function() { ' + tplJS + '; return template; }())')
        this.setState({renderMJML: template, template: templateName, loadingTemplate: false})
      }))
  }

  refreshFilms() {
    return (window.fetch("/films", { credentials: 'include' })
      .then((resp) => resp.json())
      .then((films) => this.setState({films: films.films, subject: films.subject})))
  }

  componentDidMount() {
    this.refreshTemplate(this.state.template)
    Promise.all([
      this.refreshTemplates(),
      this.refreshFilms(),
    ]).then(() => this.setState({ loading: false }))
      .catch((e) => this.setState({ error: e }))
  }

  mjmlContext(forRemote) {
    const ret = {
      films: this.state.films,
      headHTML: this.state.headHTML,
    }
    if (!forRemote) {
      Object.assign(ret, {
        moment: moment,
      })
    } else {
      Object.assign(ret, {
        template: this.state.template,
        subject: this.state.subject,
      })
    }
    return ret
  }

  handleFormChange({ headHTML, template, subject }) {
    if (this.state.template != template)
      this.refreshTemplate(template)
    if (this.state.headHTML != headHTML || this.state.subject != subject)
      this.setState({headHTML: headHTML, subject: subject})
  }

  handleFormSubmit() {
    this.setState({sendDisabled: true})
    window.fetch('/send', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify(this.mjmlContext(true)),
      credentials: 'include'
    })
      .then(checkRespOK)
      .then((resp) => {
        alert('Sent!')
      })
      .catch((e) => {
        console.error(e)
        alert('An error occurred: ' + e.toString())
      })
  }

  render() {
    const mjml = this.state.renderMJML(this.mjmlContext())
    if (this.state.error)
      return (
        <h2>Error: {this.state.error.toString()}</h2>
      )
    if (this.state.loading)
      return (
        <h2>Still loading...</h2>
      )
    return (
      <div className="content-area">
        <div className="content-area--left content-area--pane">
          <MailForm onChange={this.handleFormChange} template={this.state.template} headText={this.state.headText} templates={this.state.templates} subject={this.state.subject} disableSubmit={this.state.sendDisabled} onSubmit={this.handleFormSubmit} />
        </div>
        <div className="content-area--right content-area--pane">
          {this.state.loadingTemplate ? (<h3>Loading template <em>{this.state.loadingTemplate}</em>...</h3>) : (
            <MJMLIframe mjml={mjml} />
          )}
        </div>
      </div>
    )
  }
}

const app = document.querySelector('main')
const render = () => {
  ReactDOM.render((
    <MuiThemeProvider>
      <div>
        <AppBar title="Emailinator" showMenuIconButton={false} />
        <App />
      </div>
    </MuiThemeProvider>
  ), app)
}
render()
