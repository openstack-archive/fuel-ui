/*
 * Copyright 2016 Mirantis, Inc.
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

import $ from 'jquery';
import React from 'react';
import ReactTestUtils from 'react-addons-test-utils';
import {ProgressButton} from 'views/controls';

var node, button, assertSpinning, assertNotSpinning;

// In order to be able to emulate component' props change from the view side
// it should be rendered in container which state changing would affect component' props
var renderInContainer = (component, componentProps = {}) => {
  var PropChangeContainer = React.createClass({
    getInitialState() {
      return componentProps;
    },
    render() {
      return React.createElement(component, this.state);
    }
  });
  var container = ReactTestUtils.renderIntoDocument(<PropChangeContainer {...componentProps} />);
  var instance = ReactTestUtils.findRenderedComponentWithType(container, component);
  return [container, instance];
};

suite('Progress Button', () => {
  suiteSetup(() => {
    var isSpinning = (button) => {
      return ReactTestUtils.scryRenderedDOMComponentsWithClass(button, 'btn-progress').length === 1;
    };
    assertSpinning = (button, message) => assert.isTrue(isSpinning(button), message);
    assertNotSpinning = (button, message) => assert.isFalse(isSpinning(button), message);
  });

  setup(() => {
    [node, button] = renderInContainer(
      ProgressButton, {
        progress: false,
        forceProgressing: false,
        onClick: () => {}
      });
  });

  test('Test initial state', () => {
    assertNotSpinning(button, 'Not spinning by default');
  });

  test('Test forced spinning', () => {
    node.setState({forceProgressing: true});
    assertSpinning(button, 'Spinning when forceProgressing is true');
  });

  test('Test click reaction', () => {
    var clickHandler = $.Deferred();
    node.setState({
      onClick: () => clickHandler
    });
    // Emulate button click
    ReactTestUtils.Simulate.click(button.refs.button);

    assertNotSpinning(button, 'Not spinning after click with no progress');

    // Action started
    node.setState({progress: true});
    assertSpinning(button, 'Spinning started along with progress');

    // Action finished
    node.setState({progress: false});
    assertNotSpinning(button, 'Spinning stopped along with progress');

    clickHandler.resolve();
  });

  test('Multiple progress buttons on single view', () => {
    var clickHandler = $.Deferred();
    var [node2, button2] = renderInContainer(
      ProgressButton, {
        progress: false,
        forceProgressing: false,
        onClick: () => clickHandler
      }
    );
    // Click 2nd button
    ReactTestUtils.Simulate.click(button2.refs.button);
    node.setState({progress: true});
    node2.setState({progress: true});

    assertSpinning(button2, 'Clicked button should show progress');
    assertNotSpinning(button, 'Not clicked button should not show progress');
  });
});
