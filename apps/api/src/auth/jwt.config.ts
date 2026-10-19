const minimumSecretLength = 32;
const durationPattern = /^([1-9]\d*)(s|m|h|d)$/;

/** Defines the validated JWT settings used for signing and verification. */
export type JwtConfig = {
  secret: string;
  expiresIn: string;
  expiresInSeconds: number;
  issuer: string;
  audience: string;
};

/** Reads one required JWT environment value without exposing its value. */
function getRequiredValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for JWT authentication`);
  }

  return value;
}

/** Converts the approved JWT duration format into seconds for JwtService. */
function parseExpiresIn(value: string): number {
  const match = durationPattern.exec(value);

  if (!match) {
    throw new Error('JWT_EXPIRES_IN must be a positive duration such as 24h');
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  const seconds = amount * multiplier;

  if (!Number.isSafeInteger(seconds)) {
    throw new Error('JWT_EXPIRES_IN is too large');
  }

  return seconds;
}

/** Returns JWT settings after validating the signing secret and token claims. */
export function getJwtConfig(): JwtConfig {
  const secret = getRequiredValue('JWT_SECRET');

  if (Buffer.byteLength(secret, 'utf8') < minimumSecretLength) {
    throw new Error('JWT_SECRET must be at least 32 bytes long');
  }

  const expiresIn = getRequiredValue('JWT_EXPIRES_IN');

  return {
    secret,
    expiresIn,
    expiresInSeconds: parseExpiresIn(expiresIn),
    issuer: getRequiredValue('JWT_ISSUER'),
    audience: getRequiredValue('JWT_AUDIENCE'),
  };
}
