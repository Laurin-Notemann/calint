import pino from 'pino';

const logger = (name: string) => {
  return pino({
    name,
  });
};

export default logger; 