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
import _ from 'underscore';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translations from './translations/core.json';

var defaultLocale = 'en-US';

var i18n = _.extend(_.bind(i18next.t, i18next), {
  getLocaleName(locale) {
    return i18n('language', {lng: locale});
  },
  getLanguageName(locale) {
    return i18n('language_name', {lng: locale});
  },
  getAvailableLocales() {
    return _.keys(translations).sort();
  },
  getCurrentLocale() {
    return i18next.language;
  },
  setLocale(locale) {
    i18next.changeLanguage(locale);
  },
  addTranslations(extraTranslations) {
    //TODO: check this megre
    _.merge(i18next.options.resources, extraTranslations);
  }
});

i18next
  .use(LanguageDetector)
  .init({
    compatibilityJSON: 'v1',
    resources: translations,
    whitelist: i18n.getAvailableLocales(),
    fallbackLng: defaultLocale,
    detection: {
      lookupCookie: 'i18next',
      caches: ['cookie']
    }
  });

// export global i18n variable to use in templates
window.i18n = i18n;

export default i18n;
