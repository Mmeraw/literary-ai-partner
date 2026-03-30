export type DominatusProfile = {
  id: "dominatus";
  description: string;
  ritualEscalation: {
    preserve: boolean;
    allowCompression: boolean;
  };
};

export const dominatusProfile: DominatusProfile = {
  id: "dominatus",
  description: "Ritual-dense profile for DOMINATUS passages.",
  ritualEscalation: {
    preserve: true,
    allowCompression: false,
  },
};

export default dominatusProfile;
