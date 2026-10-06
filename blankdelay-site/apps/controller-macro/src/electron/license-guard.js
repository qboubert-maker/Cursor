'use strict';

const LICENSE_DENIED = {
  ok: false,
  code: 'LICENSE_REQUIRED',
  message: 'BlankDelay Controller Macro is required for this feature.',
};

function createLicenseGuard(getStatus) {
  function withLicenseGuard(handler) {
    return async (event, ...args) => {
      const status = getStatus();
      if (!status?.licensed) {
        return LICENSE_DENIED;
      }
      return handler(event, ...args);
    };
  }

  function guardIpcMain(ipcMain, channel, handler) {
    ipcMain.handle(channel, withLicenseGuard(handler));
  }

  return { withLicenseGuard, guardIpcMain, LICENSE_DENIED };
}

module.exports = { createLicenseGuard, LICENSE_DENIED };
