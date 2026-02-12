// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // apiUrl: 'http://localhost:3000',
  apiUrl: 'https://api.ounce24.com',
  clarityProjectId: '',
  /** Google OAuth 2.0 Web client ID (from Google Cloud Console). Leave empty to hide Google sign-in. */
  googleClientId: '11344143099-c1mu2t5lfk04ifi4shnnsohf9u84vtu3.apps.googleusercontent.com',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
