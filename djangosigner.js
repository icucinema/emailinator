import crypto from 'crypto'

import Base62 from 'base62'
import URLSafeBase64 from 'urlsafe-base64'

export class DjangoSigner {
  constructor(key, salt, sep=':') {
    this.key = key
    this.salt = salt
    this.sep = sep
  }

  constantTimeCompare(known_str, given_str) {
    return crypto.timingSafeEqual(known_str, given_str)
  }

  saltedHMAC(key_salt, secret, value) {
    const keyHash = crypto.createHash('sha1')
    keyHash.update(key_salt)
    keyHash.update(secret)

    const hmac = crypto.createHmac('sha1', keyHash.digest())
    hmac.update(value)
    return hmac.digest()
  }

  signature(value) {
    const data = this.saltedHMAC(this.salt + 'signer', this.key, value)
    return URLSafeBase64.encode(data)
  }

  sign(value) {
    return `${value}${this.sep}${this.signature(value)}`
  }

  splitOnSep(v) {
    const lastPsn = v.lastIndexOf(this.sep)
    if (lastPsn === -1) {
      throw `Couldn't find ${this.sep}`
    }
    const left = v.substring(0, lastPsn)
    const right = v.substring(lastPsn+1)
    return [left, right]
  }

  unsign(signedValue) {
    const [value, sig] = this.splitOnSep(signedValue)
    const validSig = this.signature(value)
    if (!this.constantTimeCompare(URLSafeBase64.decode(sig), URLSafeBase64.decode(validSig))) {
      throw 'Invalid signature'
    }
    return value
  }
}

export class DjangoTimestampedSigner extends DjangoSigner {
  now() {
    return ~~((+new Date()) / 1000)
  }

  getTimestamp() {
    return this.encodeTimestamp(this.now())
  }

  encodeTimestamp(ts) {
    return Base62.encode(ts)
  }

  decodeTimestamp(b62ts) {
    return Base62.decode(b62ts)
  }

  sign(value) {
    const newValue = `${value}${this.sep}${this.getTimestamp()}`
    return super.sign(newValue)
  }

  unsign(signedValue, maxAge=null) {
    const timestampedValue = super.unsign(signedValue)
    const [value, b62ts] = this.splitOnSep(timestampedValue)
    const ts = this.decodeTimestamp(b62ts)
    if (maxAge) {
      const age = this.now() - ts
      if (age > maxAge)
        throw `Signature age ${age} > ${maxAge} seconds!`
    }
    return value
  }
}

export class DjangoJSONSigner extends DjangoTimestampedSigner {
  sign(value) {
    const strv = URLSafeBase64.encode(Buffer.from(JSON.stringify(value)))
    const signedValue = super.sign(strv)
    return `"${signedValue}"`
  }

  unsign(signedValue, maxAge=null) {
    if (signedValue[0] != '"' || signedValue[signedValue.length-1] != '"')
      throw 'Not wrapped in quotes as expected'
    const strippedValue = signedValue.substring(1, signedValue.length-1)
    const value = URLSafeBase64.decode(super.unsign(strippedValue))
    return JSON.parse(value)
  }
}
