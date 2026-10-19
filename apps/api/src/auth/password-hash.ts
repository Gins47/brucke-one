import {
  argon2,
  randomBytes,
  timingSafeEqual,
  type Argon2Parameters,
} from 'node:crypto';

const algorithm = 'argon2id';
const formatVersion = 'v1';
const memory = 65536;
const passes = 3;
const parallelism = 2;
const tagLength = 32;
const saltLength = 16;
const maximumMemory = 262144;
const maximumPasses = 10;
const maximumParallelism = 4;
const minimumTagLength = 16;
const maximumTagLength = 64;

type ParsedPasswordHash = {
  salt: Buffer;
  hash: Buffer;
  parameters: Argon2Parameters;
};

/** Confirms that the runtime supports Node's built-in asynchronous Argon2 API. */
function assertArgon2Runtime(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);

  if (
    major < 24 ||
    (major === 24 && minor < 7) ||
    typeof argon2 !== 'function'
  ) {
    throw new Error('Built-in Argon2id requires Node.js 24.7.0 or later');
  }
}

/** Derives an Argon2id key without blocking the Node.js event loop. */
function deriveKey(parameters: Argon2Parameters): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(algorithm, parameters, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });
}

/** Parses the versioned password format needed to verify an existing password. */
function parsePasswordHash(value: string): ParsedPasswordHash {
  const parts = value.split('$');

  if (parts.length !== 5) {
    throw new Error('Invalid password hash format');
  }

  const [storedAlgorithm, version, parameterValues, saltValue, hashValue] =
    parts;

  if (storedAlgorithm !== algorithm || version !== formatVersion) {
    throw new Error('Unsupported password hash format');
  }

  const parameterMatch = /^m=(\d+),t=(\d+),p=(\d+),l=(\d+)$/.exec(
    parameterValues,
  );

  if (!parameterMatch) {
    throw new Error('Invalid password hash format');
  }

  const [, memoryValue, passesValue, parallelismValue, tagLengthValue] =
    parameterMatch;
  const storedMemory = Number(memoryValue);
  const storedPasses = Number(passesValue);
  const storedParallelism = Number(parallelismValue);
  const storedTagLength = Number(tagLengthValue);
  const salt = Buffer.from(saltValue, 'base64url');
  const hash = Buffer.from(hashValue, 'base64url');

  if (
    !Number.isSafeInteger(storedMemory) ||
    !Number.isSafeInteger(storedPasses) ||
    !Number.isSafeInteger(storedParallelism) ||
    !Number.isSafeInteger(storedTagLength) ||
    storedMemory < 8 * storedParallelism ||
    storedMemory > maximumMemory ||
    storedPasses < 2 ||
    storedPasses > maximumPasses ||
    storedParallelism < 2 ||
    storedParallelism > maximumParallelism ||
    storedTagLength < minimumTagLength ||
    storedTagLength > maximumTagLength ||
    salt.length < saltLength ||
    salt.length > 64 ||
    hash.length !== storedTagLength
  ) {
    throw new Error('Invalid password hash format');
  }

  return {
    salt,
    hash,
    parameters: {
      message: '',
      nonce: salt,
      memory: storedMemory,
      passes: storedPasses,
      parallelism: storedParallelism,
      tagLength: storedTagLength,
    },
  };
}

/** Creates a fresh Argon2id password hash in the versioned storage format. */
export async function hashPassword(password: string): Promise<string> {
  assertArgon2Runtime();

  const salt = randomBytes(saltLength);
  const parameters: Argon2Parameters = {
    message: Buffer.from(password, 'utf8'),
    nonce: salt,
    memory,
    passes,
    parallelism,
    tagLength,
  };
  const hash = await deriveKey(parameters);

  return `${algorithm}$${formatVersion}$m=${memory},t=${passes},p=${parallelism},l=${tagLength}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/** Verifies a password by deriving a hash with its stored salt and parameters. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  assertArgon2Runtime();

  const { salt, hash, parameters } = parsePasswordHash(storedHash);
  const derivedHash = await deriveKey({
    ...parameters,
    message: Buffer.from(password, 'utf8'),
    nonce: salt,
  });

  if (hash.length !== derivedHash.length) {
    return false;
  }

  return timingSafeEqual(hash, derivedHash);
}
