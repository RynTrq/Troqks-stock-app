import {randomBytes, scrypt as scryptCallback, timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const HASH_VERSION = "scrypt";

export const hashPassword = async (password: string) => {
    const salt = randomBytes(SALT_LENGTH).toString("base64url");
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

    return `${HASH_VERSION}:${salt}:${derivedKey.toString("base64url")}`;
};

export const verifyPassword = async (password: string, passwordHash: string) => {
    const [version, salt, storedKey] = passwordHash.split(":");

    if (version !== HASH_VERSION || !salt || !storedKey) return false;

    const storedBuffer = Buffer.from(storedKey, "base64url");
    const derivedKey = (await scrypt(password, salt, storedBuffer.length)) as Buffer;

    if (storedBuffer.length !== derivedKey.length) return false;

    return timingSafeEqual(storedBuffer, derivedKey);
};
