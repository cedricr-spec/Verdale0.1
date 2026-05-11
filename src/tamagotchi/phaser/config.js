import Phaser from 'phaser';

export const createPhaserConfig = (parent) => {
  return {
    type: Phaser.AUTO,
    parent,
    transparent: true,
    render: {
      pixelArt: true,
      antialias: false,
    },
    // React/CSS owns container sizing; NONE tells Phaser not to touch canvas styles.
    scale: {
      mode: Phaser.Scale.NONE,
      expandParent: false,
    },
  };
};

export default createPhaserConfig;
