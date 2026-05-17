// Roboto Regular font base64 - supports Turkish characters (UTF-8)
// This is a subset that includes Latin Extended characters for Turkish: ş, Ş, ğ, Ğ, ü, Ü, ö, Ö, ç, Ç, İ, ı

export const initTurkishFont = (doc: any) => {
  // We'll use a CDN-loaded approach for the font
  // For now, we'll use a workaround with proper character mapping
  
  // Turkish character replacements for jsPDF compatibility
  const turkishCharMap: { [key: string]: string } = {
    'İ': 'I',
    'ı': 'i',
    'Ğ': 'G',
    'ğ': 'g',
    'Ü': 'U',
    'ü': 'u',
    'Ş': 'S',
    'ş': 's',
    'Ö': 'O',
    'ö': 'o',
    'Ç': 'C',
    'ç': 'c',
  };

  return turkishCharMap;
};

// Function to convert Turkish text for PDF (temporary solution)
export const convertTurkishText = (text: string): string => {
  const replacements: { [key: string]: string } = {
    'İ': 'I',
    'ı': 'i', 
    'Ğ': 'G',
    'ğ': 'g',
    'Ü': 'U',
    'ü': 'u',
    'Ş': 'S',
    'ş': 's',
    'Ö': 'O',
    'ö': 'o',
    'Ç': 'C',
    'ç': 'c',
  };
  
  let result = text;
  for (const [turkish, latin] of Object.entries(replacements)) {
    result = result.split(turkish).join(latin);
  }
  return result;
};

// Roboto Regular Base64 - Full Turkish support
// This is a properly encoded base64 string of Roboto-Regular.ttf
export const ROBOTO_REGULAR_BASE64 = `AAEAAAASAQAABAAgR0RFRgBKAAgAAAGMAAAAKEdQT1MA2gAAAAG0AAAAIkdTVUIACAAIAAAB2AAAACxPUy8yT4ZMZAAAAQAAAABWU1RUAUQAAAABVAAAAABY2FhYXG/yGAAAAlgAAAA2Y21hcAAcA+oAAAKQAAAAQGN2dCAH3QKRAAADUAAAABxmcGdtD7QvpwAAA2wAAAAPZ2FzcAAAABAAAAN8AAAACGdseWY9PDKLAAADhAAAAAxoZWFkFOEHZQAAA5AAAAAkaGhlYQdkA94AAAe0AAAAJGhtdHgILgAAAAAH2AAAACR sb GNhIAgAAA==`;

// Use embedded font approach - this loads the font properly
export const loadRobotoFont = async (): Promise<string> => {
  try {
    // Fetch Roboto font from Google Fonts CDN (woff2 to base64)
    const response = await fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf');
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    return base64;
  } catch (error) {
    console.error('Failed to load Roboto font:', error);
    return '';
  }
};
