export const generateRandomString = (length) => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const generateRandomUsername = () => {
  const username = `user${generateRandomString(10)}`; // Generates a username like "userxxyyzz1122"
  return username;
};

export const generateRandomPassword = () => {
  const password = `${generateRandomString(8)}-${generateRandomString(
    4,
  )}@${generateRandomString(4)}`; // Generates a password like "abcd1234-abcd@1234"
  return password;
};
