import { expect } from 'chai';
import { EventEmitter } from 'events';
import JSONRPC from 'jsonrpc-dispatch';
import sinon from 'sinon';

import Frame from '../src/consumer/frame';
import URI from '../src/lib/uri';


describe('Frame', () => {
  it('should be an instance of EventEmitter', () => {
    expect(new Frame()).to.be.an.instanceof(EventEmitter);
  });

  describe('#init() with secret', () => {
    const container = document.body;
    const source = "*";
    const iframeAttrs = { allow: 'camera' };
    const options = { secret: 123, iframeAttrs };
    const frame = new Frame();
    frame.init(container, source, options);

    it('sets the container', () => expect(frame.container).to.equal(container));
    it('sets the source', () => expect(frame.source).to.equal(source));
    it('sets the secret', () => expect(frame.secret).to.equal(options.secret));
    it('sets the iframeAttrs', () => expect(frame.iframeAttrs).to.equal(iframeAttrs));
    it('sets the JSONRPC', () => expect(frame.JSONRPC).to.be.an.instanceof(JSONRPC));
  });

  describe('#init() without secret', () => {
    const container = document.body;
    const source = 'http://test.com:8080/test';
    const iframeAttrs = { allow: 'camera; geolocation' };
    const frame = new Frame();
    frame.init(container, source, { iframeAttrs });

    it('sets the container', () => expect(frame.container).to.equal(container));
    it('sets the source', () => expect(frame.source).to.equal(source));
    it('sets the secret to null', () => expect(frame.secret).to.be.null);
    it('sets the iframeAttrs', () => expect(frame.iframeAttrs).to.equal(iframeAttrs));
    it('sets the JSONRPC', () => expect(frame.JSONRPC).to.be.an.instanceof(JSONRPC));

    describe('#mount()', () => {
      const emit = sinon.stub();
      frame.on('xfc.mounted', () => emit());
      frame.mount();

      it("sets the wrapper's data-status to mounted", () => {
        expect(frame.wrapper.getAttribute('data-status')).to.equal('mounted');
      });
      it("sets the iframe's src to source", () => {
        expect(frame.iframe.src).to.equal(source);
      });
      it("sets the iframe's custom attributes", () => {
        Object.entries(iframeAttrs).forEach(([key, value]) => {
          expect(frame.iframe.getAttribute(key)).to.equal(value);
        });
      });
      it("emits 'xfc.mounted' event", () => {
        sinon.assert.called(emit);
      });
    });

    describe('#unmount()', () => {
      const emit = sinon.stub();
      frame.cleanup = sinon.stub();
      frame.on('xfc.unmounted', () => emit());
      frame.unmount();

      it("removes the wrapper from container's child nodes", () => {
        expect(frame.wrapper.parentNode).to.not.equal(frame.container);
      });
      it("calls method 'cleanup'", () => {
        sinon.assert.called(frame.cleanup);
      });
      it("emits 'xfc.unmounted' event", () => {
        sinon.assert.called(emit);
      });
    });

    describe('#load()', () => {
      const newURL = 'http://localhost:8080/test';

      it("sets the frame's origin to the origin of newURL", () => {
        frame.load(newURL);
        expect(frame.origin).to.equal(new URI(newURL).origin);
      });
      it("sets the frame's source to newURL", () => {
        frame.load(newURL);
        expect(frame.source).to.equal(newURL);
      });
      it("sets the iframe's src to newURL", () => {
        frame.load(newURL);
        expect(frame.iframe.src).to.equal(newURL);
      });
    });

    describe('#send(message)', () => {
      it("calls postMessage with given message on iframe.contentWindow", sinon.test(function() {
        const postMessage = this.stub(frame.iframe.contentWindow, "postMessage");
        const message = {data: 'test'};
        frame.send(message);

        sinon.assert.calledWith(postMessage, message);
      }));
    });

    describe('#trigger(event, detail)', () => {
      it("calls this.JSONRPC.notification of 'event' with event and detail", sinon.test(function() {
        const notification = this.stub(frame.JSONRPC, 'notification');
        const event = 'TestEvent';
        const detail = {data: 'test'};
        frame.trigger(event, detail);

        sinon.assert.calledWith(notification, 'event', [event, detail]);
      }));
    });

    describe('#handleProviderMessage(event)', () => {
      const handle = sinon.stub(frame.JSONRPC, 'handle');
      after(()=> handle.restore());

      it("ignores non-JSONRPC messages", () => {
        const event = {data: 'bad data'};
        frame.handleProviderMessage(event);

        sinon.assert.notCalled(handle);
      });

      it("ignores messages from different frame windows", () => {
        const event = {data: {jsonrpc: '2.0'}, source: null};
        frame.handleProviderMessage(event);

        sinon.assert.notCalled(handle);
      });

      it("doesn't ignore messages from different origins", () => {
        const event = {
          data: {jsonrpc: '2.0'},
          source: frame.iframe.contentWindow,
          origin: 'invalid_origin'
        };
        frame.handleProviderMessage(event);

        sinon.assert.called(handle);
      });

      it("calls this.JSONRPC.handle with the data of given event", () => {
        const event = {
          data: {jsonrpc: '2.0'},
          source: frame.iframe.contentWindow,
          origin: frame.origin
        };
        frame.handleProviderMessage(event);

        sinon.assert.calledWith(handle, event.data);
      });
    });
  });
});
