// Machine data for DAYAN CALCULATOR

export interface Machine {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export const MACHINES: Machine[] = [
  {
    id: "kucuk-azdirma",
    name: "Küçük Azdırma",
    description: "Küçük modüllü dişliler için azdırma makinesi",
  },
  {
    id: "reishauer-taslama",
    name: "REISHAUER Taşlama",
    description: "Yüksek hassasiyetli profil taşlama makinesi",
  },
  {
    id: "yatay-azdirma",
    name: "Yatay Azdırma",
    description: "Yatay tip azdırma makinesi",
  },
  {
    id: "fellows-lorenz-snj5",
    name: "Fellows Makinesi Lorenz SNJ5",
    description: "Lorenz SNJ5 model Fellows makinesi",
  },
  {
    id: "pfauter-p403",
    name: "Azdırma Makinesi Pfauter P403",
    description: "Pfauter P403 model azdırma makinesi",
  },
  {
    id: "fellows-lorenz-s71",
    name: "Fellows Makinesi Lorenz S71",
    description: "Lorenz S71 model Fellows makinesi",
  },
  {
    id: "azdirma-genel",
    name: "Azdırma (Genel)",
    description: "Genel amaçlı azdırma makinesi",
  },
  {
    id: "torna-tezgahi",
    name: "Torna Tezgahı",
    description: "Dişli tornalama işlemleri için torna tezgahı",
  },
  {
    id: "silindirik-taslama",
    name: "Silindirik Taşlama Makinesi",
    description: "Silindirik yüzey taşlama makinesi",
  },
  {
    id: "gleason",
    name: "Gleason Makinesi",
    description: "Konik dişli üretimi için Gleason makinesi",
  },
  {
    id: "hurth",
    name: "Hurth Makinesi",
    description: "Hurth marka dişli makinesi",
  },
  {
    id: "liebherr",
    name: "Liebherr Makinesi",
    description: "Liebherr marka hassas dişli makinesi",
  },
];

export function getMachineById(id: string): Machine | undefined {
  return MACHINES.find((m) => m.id === id);
}
