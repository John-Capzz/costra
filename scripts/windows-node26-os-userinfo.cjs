// Node 26 on Windows can throw ENOMEM from os.userInfo() when tsx creates its
// temporary directory. Keep the workaround at the process boundary; do not
// change application code or authentication behavior.
const os = require('node:os')
const originalUserInfo = os.userInfo

os.userInfo = function patchedUserInfo() {
  try {
    return originalUserInfo.call(os)
  } catch {
    return { username: process.env.USERNAME || 'costra-user' }
  }
}
