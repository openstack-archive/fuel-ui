/*
 * Copyright 2015 Mirantis, Inc.
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

import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import dispatcher from 'dispatcher';
import utils from 'utils';
import {dispatcherMixin} from 'component_mixins';
import {
  Navbar, Breadcrumbs, PageLoadProgressBar, DefaultPasswordWarning, BootstrapError, Footer
} from 'views/layout';
import {DragDropContext} from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

var RootComponent = React.createClass({
  mixins: [
    dispatcherMixin('updatePageLayout', 'updateTitle'),
    dispatcherMixin('showDefaultPasswordWarning', 'showDefaultPasswordWarning'),
    dispatcherMixin('hideDefaultPasswordWarning', 'hideDefaultPasswordWarning')
  ],
  statics: {
    breadcrumbTitle: 'home'
  },
  showDefaultPasswordWarning() {
    this.setState({showDefaultPasswordWarning: true});
  },
  hideDefaultPasswordWarning() {
    this.setState({showDefaultPasswordWarning: false});
  },
  getInitialState() {
    return {
      showDefaultPasswordWarning: false
    };
  },
  getCurrentComponent() {
    var {children} = this.props;
    // If component fetches its data AsyncProps wraps it and exposes Component as
    // children.props.Component. If AsyncProps isn't involved Component should be
    // got as children.type
    return children.props.Component || children.type;
  },
  updateTitle() {
    var {Page} = this.state;
    var title = Page &&
      (_.isFunction(Page.title) ? Page.title(this.state.pageOptions) : Page.title);
    document.title = i18n('common.title') + (title ? ' - ' + title : '');
  },
  componentDidMount() {
    dispatcher.on('pageLoadStarted', this.componentDataFetchingStarted, this);
    dispatcher.on('pageLoadFinished', this.componentDataFetchingFinished, this);
  },
  componentDidUpdate() {
    dispatcher.trigger('updatePageLayout');
  },
  componentWillUnmount() {
    dispatcher.off(null, null, this);
  },
  componentsLoading: 0,
  componentDataFetchingStarted() {
    this.componentsLoading++;
  },
  componentDataFetchingFinished() {
    if (--this.componentsLoading) {
      return;
    }
  },
  getBreadcrumbs() {
    var accumulatedPath = '';
    var breadcrumbs = _.compact(_.map(app.routerComponent.state.routes, (route) => {
      var breadcrumb = (route.component.DecoratedComponent || route.component).breadcrumbTitle;
      if (!breadcrumb) {
        return;
      }
      breadcrumb = _.isFunction(breadcrumb) ?
        _.invoke(route.component, 'breadcrumbTitle') : breadcrumb;

      accumulatedPath = (accumulatedPath + '/' + utils.injectRouteParams(route, this.props.params))
        .replace('//', '/');

      if (!_.isArray(breadcrumb)) {
        return [breadcrumb, accumulatedPath, {}];
      }
      var [title, options = {}] = breadcrumb;
      return [title, accumulatedPath, options];
    }));
    _.last(breadcrumbs)[2].active = true;
    return breadcrumbs;
  },
  render() {
    var {showDefaultPasswordWarning} = this.state;
    var {fuelSettings, version} = this.props.route;
    var {children} = this.props;
    var Component = this.getCurrentComponent();
    var isLayoutHidden = _.isUndefined(Component) ? false : !!Component.hiddenLayout;
    var navbarActiveElement = Component.navbarActiveElement;

    var layoutClasses = {
      clamp: true,
      'fixed-width-layout': !isLayoutHidden
    };

    return (
      <div id='content-wrapper'>
        <div className={utils.classNames(layoutClasses)}>
          {!isLayoutHidden && [
            <PageLoadProgressBar key='page-load-progress' />,
            <Navbar
              key='navbar'
              ref='navbar'
              navbarActiveElement={navbarActiveElement}
              {...this.props}
              {...this.props.route}
            />,
            <Breadcrumbs
              key='breadcrumbs'
              ref='breadcrumbs'
              getBreadcrumbs={this.getBreadcrumbs}
            />,
            showDefaultPasswordWarning &&
              <DefaultPasswordWarning
                key='password-warning'
                close={this.hideDefaultPasswordWarning}
              />,
            fuelSettings.get('bootstrap.error.value') &&
              <BootstrapError
                key='bootstrap-error'
                text={fuelSettings.get('bootstrap.error.value')}
              />
          ]}
          <div id='content'>
            {children}
          </div>
          {!isLayoutHidden && <div id='footer-spacer'></div>}
        </div>
        {!isLayoutHidden && <Footer version={version} />}
      </div>
    );
  }
});

export default DragDropContext(HTML5Backend)(RootComponent);
