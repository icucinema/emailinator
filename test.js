import test from 'tape'

import { DjangoSigner, DjangoTimestampedSigner, DjangoJSONSigner } from './djangosigner'

test('DjangoSigner signs correctly', (assert) => {
  const ds = new DjangoSigner('key', 'salt')
  const sig = ds.sign('blah')
  assert.equal(sig, 'blah:64vfREBIU3Gxzazd9cCBhN8HCEw', 'signed message should be correct')
  assert.end()
})

test('DjangoSigner unsigns correctly', (assert) => {
  const ds = new DjangoSigner('key', 'salt')
  try {
    const msg = ds.unsign('blah:64vfREBIU3Gxzazd9cCBhN8HCEw')
    assert.equal(msg, 'blah', 'decoded message should be "blah"')
  } catch (e) {
    assert.fail(e)
  }
  assert.end()
})

test('DjangoTimestampedSigner signs correctly', (assert) => {
  const dts = new DjangoTimestampedSigner('key', 'salt')
  dts.now = () => 1234567890;
  const got = dts.sign('blah')
  assert.equal(got, 'blah:1ly7vk:7wHOkfroZXuN4lReDWIJF84ChJI')
  assert.end()
})

test('DjangoTimestampedSigner unsigns correctly', (assert) => {
  const dts = new DjangoTimestampedSigner('key', 'salt')
  dts.now = () => 1234567890;
  const got = dts.unsign('blah:1LY7VK:gyGYmaFz62a8UBJjm7ShqWBGgtQ')
  assert.equal(got, 'blah')
  assert.end()
})

test('DjangoJSONSigner signs correctly', (assert) => {
  const djs = new DjangoJSONSigner('key', 'salt')
  djs.now = () => 1234567890;
  const got = djs.sign({'key': 'value'})
  assert.equal(got, '"eyJrZXkiOiJ2YWx1ZSJ9:1ly7vk:aNxXIPeMX1VY_l55fmS5b4hyWvQ"')
  assert.end()
})

test('DjangoJSONSigner unsigns correctly', (assert) => {
  const djs = new DjangoJSONSigner('key', 'salt')
  djs.now = () => 1234567890;
  const got = djs.unsign('"eyJrZXkiOiJ2YWx1ZSJ9:1LY7VK:K7kXTwk6KiFmCcX85hwWr2vz-qk"')
  assert.deepEqual(got, {'key': 'value'})
  assert.end()
})
