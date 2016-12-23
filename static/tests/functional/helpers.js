/*
 * Copyright 2014 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import _ from 'intern/dojo/node!lodash';
import assert from 'intern/chai!assert';
import Command from 'intern/dojo/node!leadfoot/Command';

_.defaults(Command.prototype, {
  clickLinkByText(text) {
    return new this.constructor(this, function() {
      return this.parent
        .findByLinkText(text)
          .click()
          .end();
    });
  },
  clickByCssSelector(cssSelector) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .click()
          .end();
    });
  },
  waitForCssSelector(cssSelector, timeout) {
    return new this.constructor(this, function() {
      var currentTimeout;
      return this.parent
        .getFindTimeout()
        .then((value) => {
          currentTimeout = value;
        })
        .setFindTimeout(timeout)
        .findByCssSelector(cssSelector)
          .catch((error) => {
            this.parent.setFindTimeout(currentTimeout);
            throw error;
          })
          .end()
        .then(() => {
          this.parent.setFindTimeout(currentTimeout);
        });
    });
  },
  waitForElementDeletion(cssSelector, timeout) {
    return new this.constructor(this, function() {
      var currentTimeout;
      return this.parent
        .getFindTimeout()
        .then((value) => {
          currentTimeout = value;
        })
        .setFindTimeout(timeout)
        .waitForDeletedByCssSelector(cssSelector)
        .catch((error) => {
          this.parent.setFindTimeout(currentTimeout);
          if (error.name !== 'Timeout') throw error;
        })
        .then(() => {
          this.parent.setFindTimeout(currentTimeout);
        });
    });
  },
  setInputValue(cssSelector, value) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .clearValue()
          .type(value)
          .end();
    });
  },
  // Drag-n-drop helpers
  // Taken from not yet accepted pull request to leadfoot from
  // https://github.com/theintern/leadfoot/pull/16
  dragFrom(element, x, y) {
    if (typeof element === 'number') {
      y = x;
      x = element;
      element = null;
    }
    return new this.constructor(this, function() {
      this._session._dragSource = {
        element: element || this.parent._context[0],
        x: x,
        y: y
      };
    });
  },
  dragTo(element, x, y) {
    if (typeof element === 'number') {
      y = x;
      x = element;
      element = null;
    }

    return new this.constructor(this, function() {
      var dragTarget = {
        element: element || this.parent._context[0],
        x: x,
        y: y
      };
      var dragSource = this._session._dragSource;
      this._session._dragSource = null;

      return this.parent.executeAsync((dragFrom, dragTo, done) => {
        var dragAndDrop = (function() {
          var dispatchEvent, createEvent;

          // Setup methods to call the proper event creation and
          // dispatch functions for the current platform.
          if (document.createEvent) {
            dispatchEvent = function(element, eventName, event) {
              element.dispatchEvent(event);
              return event;
            };

            createEvent = function(eventName) {
              return document.createEvent(eventName);
            };
          } else if (document.createEventObject) {
            dispatchEvent = function(element, eventName, event) {
              element.fireEvent('on' + eventName, event);
              return event;
            };

            createEvent = function(eventType) {
              return document.createEventObject(eventType);
            };
          }

          function createCustomEvent(eventName, screenX, screenY, clientX, clientY) {
            var event = createEvent('CustomEvent');
            if (event.initCustomEvent) {
              event.initCustomEvent(eventName, true, true, null);
            }

            event.view = window;
            event.detail = 0;
            event.screenX = screenX;
            event.screenY = screenY;
            event.clientX = clientX;
            event.clientY = clientY;
            event.ctrlKey = false;
            event.altKey = false;
            event.shiftKey = false;
            event.metaKey = false;
            event.button = 0;
            event.relatedTarget = null;

            return event;
          }

          function createDragEvent(eventName, options, dataTransfer) {
            var screenX = window.screenX + options.clientX;
            var screenY = window.screenY + options.clientY;
            var clientX = options.clientX;
            var clientY = options.clientY;
            var event;

            if (!dataTransfer) {
              dataTransfer = {
                data: options.dragData || {},
                setData(eventName, val) {
                  if (typeof val === 'string') {
                    this.data[eventName] = val;
                  }
                },
                getData(eventName) {
                  return this.data[eventName];
                },
                clearData() {
                  this.data = {};
                  return true;
                },
                setDragImage() {}
              };
            }

            try {
              event = createEvent('DragEvent');
              event.initDragEvent(eventName, true, true, window, 0, screenX, screenY, clientX,
                clientY, false, false, false, false, 0, null, dataTransfer);
            } catch (error) {
              event = createCustomEvent(eventName, screenX, screenY, clientX, clientY);
              event.dataTransfer = dataTransfer;
            }

            return event;
          }

          function createMouseEvent(eventName, options, dataTransfer) {
            var screenX = window.screenX + options.clientX;
            var screenY = window.screenY + options.clientY;
            var clientX = options.clientX;
            var clientY = options.clientY;
            var event;

            try {
              event = createEvent('MouseEvent');
              event.initMouseEvent(eventName, true, true, window, 0, screenX, screenY, clientX,
                clientY, false, false, false, false, 0, null);
            } catch (error) {
              event = createCustomEvent(eventName, screenX, screenY, clientX, clientY);
            }

            if (dataTransfer) {
              event.dataTransfer = dataTransfer;
            }

            return event;
          }

          function simulateEvent(element, eventName, dragStartEvent, options) {
            var dataTransfer = dragStartEvent ? dragStartEvent.dataTransfer : null;
            var createEvent = eventName.indexOf('mouse') !== -1 ? createMouseEvent :
              createDragEvent;
            var event = createEvent(eventName, options, dataTransfer);
            return dispatchEvent(element, eventName, event);
          }

          function getClientOffset(elementInfo) {
            var bounds = elementInfo.element.getBoundingClientRect();
            var xOffset = bounds.left + (elementInfo.x || ((bounds.right - bounds.left) / 2));
            var yOffset = bounds.top + (elementInfo.y || ((bounds.bottom - bounds.top) / 2));
            return {clientX: xOffset, clientY: yOffset};
          }

          function doDragAndDrop(source, target, sourceOffset, targetOffset) {
            simulateEvent(source, 'mousedown', null, sourceOffset);
            var start = simulateEvent(source, 'dragstart', null, sourceOffset);
            simulateEvent(target, 'dragenter', start, targetOffset);
            simulateEvent(target, 'dragover', start, targetOffset);
            simulateEvent(target, 'drop', start, targetOffset);
            simulateEvent(source, 'dragend', start, targetOffset);
          }

          return function(dragFrom, dragTo) {
            var fromOffset = getClientOffset(dragFrom);
            var toOffset = getClientOffset(dragTo);
            doDragAndDrop(dragFrom.element, dragTo.element, fromOffset, toOffset);
          };
        })();

        try {
          dragAndDrop(dragFrom, dragTo);
          done(null);
        } catch (error) {
          done(error.message);
        }
      }, [dragSource, dragTarget]).finally((result) => {
        if (result) {
          var error = new Error(result);
          error.name = 'DragAndDropError';
          throw error;
        }
      });
    });
  },
  // assertion helpers
  assertElementsExist(cssSelector, amount, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findAllByCssSelector(cssSelector)
          .then((elements) => {
            if (!_.isNumber(amount)) {
              // no amount given - check if any amount of such elements exist
              message = amount;
              return assert.ok(elements.length, message);
            } else {
              return assert.equal(elements.length, amount, message);
            }
          })
          .end();
    });
  },
  assertElementExists(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent.assertElementsExist(cssSelector, 1, message);
    });
  },
  assertElementNotExists(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent.assertElementsExist(cssSelector, 0, message);
    });
  },
  assertElementAppears(cssSelector, timeout, message) {
    return new this.constructor(this, function() {
      return this.parent
        .waitForCssSelector(cssSelector, timeout)
        .catch(() => true)
        .assertElementExists(cssSelector, message);
    });
  },
  assertElementsAppear(cssSelector, timeout, message) {
    return new this.constructor(this, function() {
      return this.parent
        .waitForCssSelector(cssSelector, timeout)
        .catch(() => true)
        .assertElementsExist(cssSelector, message);
    });
  },
  assertElementDisappears(cssSelector, timeout, message) {
    return new this.constructor(this, function() {
      return this.parent
        .waitForElementDeletion(cssSelector, timeout)
        .catch(() => true)
        .assertElementNotExists(cssSelector, message);
    });
  },
  assertElementEnabled(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .isEnabled()
          .then((isEnabled) => assert.isTrue(isEnabled, message))
          .end();
    });
  },
  assertElementDisabled(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .isEnabled()
          .then((isEnabled) => assert.isFalse(isEnabled, message))
          .end();
    });
  },
  assertElementDisplayed(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .isDisplayed()
          .then((isDisplayed) => assert.isTrue(isDisplayed, message))
          .end();
    });
  },
  assertElementNotDisplayed(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .isDisplayed()
          .then((isDisplayed) => assert.isFalse(isDisplayed, message))
          .end();
    });
  },
  assertElementTextEquals(cssSelector, expectedText, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getVisibleText()
          .then((actualText) => assert.equal(actualText, expectedText, message))
          .end();
    });
  },
  assertElementContainsText(cssSelector, text, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getVisibleText()
          .then((actualText) => assert.include(actualText, text, message))
          .end();
    });
  },
  assertElementMatchesRegExp(cssSelector, regExp, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getVisibleText()
          .then((actualText) => assert.match(actualText, regExp, message))
          .end();
    });
  },
  assertElementNotMatchesRegExp(cssSelector, regExp, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getVisibleText()
          .then((actualText) => assert.notMatch(actualText, regExp, message))
          .end();
    });
  },
  assertElementNotContainsText(cssSelector, text, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getVisibleText()
          .then((actualText) => assert.notInclude(actualText, text, message))
          .end();
    });
  },
  assertElementPropertyEquals(cssSelector, attribute, expectedText, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getProperty(attribute)
          .then((actualText) => assert.equal(actualText, expectedText, message))
          .end();
    });
  },
  assertElementPropertyNotEquals(cssSelector, attribute, textToCheck, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getProperty(attribute)
          .then((actualText) => assert.notEqual(actualText, textToCheck, message))
          .end();
    });
  },
  assertElementPropertyContains(cssSelector, attribute, text, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getProperty(attribute)
          .then((actualText) => assert.include(actualText, text, message))
          .end();
    });
  },
  assertElementPropertyMatchesRegExp(cssSelector, attribute, regExp, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .getProperty(attribute)
          .then((actualText) => assert.match(actualText, regExp, message))
          .end();
    });
  },
  assertElementSelected(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .isSelected()
            .then((isSelected) => assert.isTrue(isSelected, message))
          .end();
    });
  },
  assertElementNotSelected(cssSelector, message) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
          .isSelected()
            .then((isSelected) => assert.isFalse(isSelected, message))
          .end();
    });
  },
  assertIsIntegerContentPositive(cssSelector, attributeName) {
    return new this.constructor(this, function() {
      return this.parent
        .findByCssSelector(cssSelector)
        .getVisibleText()
          .then(
            (text) => assert.isTrue(parseInt(text, 10) > 0, attributeName + ' is greater than 0')
          )
        .end();
    });
  }
});

var serverHost = process.env.FUEL_UI_HOST || '127.0.0.1';
var serverPort = process.env.NAILGUN_PORT || 5544;
var serverUrl = 'http://' + serverHost + ':' + serverPort;
var username = 'admin';
var password = 'admin';

export default {username, password, serverUrl};
