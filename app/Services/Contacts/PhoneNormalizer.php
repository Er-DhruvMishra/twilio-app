<?php

namespace App\Services\Contacts;

use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberUtil;

class PhoneNormalizer
{
    /**
     * Returns [e164, digits-only-normalized]. Falls back to a best-effort
     * digits-only string if libphonenumber can't parse the input.
     *
     * @return array{0:string,1:string}
     */
    public static function normalize(string $input, string $defaultRegion = 'US'): array
    {
        $util = PhoneNumberUtil::getInstance();
        try {
            $parsed = $util->parse($input, $defaultRegion);
            if ($util->isValidNumber($parsed)) {
                $e164 = $util->format($parsed, PhoneNumberFormat::E164);
                return [$e164, preg_replace('/\D/', '', $e164)];
            }
        } catch (NumberParseException) {
            // fall through
        }
        $digits = preg_replace('/\D/', '', $input);
        $e164 = $digits === '' ? $input : '+' . $digits;
        return [$e164, $digits];
    }
}
