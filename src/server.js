require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const path = require('path');

const ClientError = require('../src/exceptions/ClientError');
const NotFoundError = require('../src/exceptions/NotFoundError');
const AuthorizationError = require('../src/exceptions/AuthorizationError');
const AuthenticationError = require('../src/exceptions/AuthenticationError');

const notes = require('./api/notes');
const NotesService = require('./services/postgres/NotesService');
const NotesValidator = require('./validator/notes');

const users = require('./api/users');
const UsersService = require('./services/postgres/UsersService');
const UsersValidator = require('./validator/users');

const authentications = require('./api/authentications');
const AuthenticationsService = require('./services/postgres/AuthenticationsService');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validator/authentications');

const collaborations = require('./api/collaborations');
const CollaborationsService = require('./services/postgres/CollaborationsService');
const CollaborationsValidator = require('./validator/collaborations');

const _exports = require('./api/exports');
const ProducerService = require('./services/rabbitmq/ProducerService');
const ExportsValidator = require('./validator/exports');

const uploads = require('./api/uploads');
const StorageService = require('./services/storage/StorageService');
const UploadsValidator = require('./validator/uploads');

const CacheService = require('./services/redis/CacheService');

const init = async () => {
  const cacheService = new CacheService();
  const collaborationsService = new CollaborationsService(cacheService);
  const notesService = new NotesService(collaborationsService, cacheService);
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const storageService = new StorageService(path.resolve(__dirname, 'api/uploads/file/images'));

  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  });

  await server.register([
    {
      plugin: Jwt,
    },
    {
      plugin: Inert,
    },
  ]);

  server.auth.strategy('notesapp_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  await server.register([
    {
      plugin: notes,
      options: {
        service: notesService,
        validator: NotesValidator,
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: collaborations,
      options: {
        collaborationsService,
        notesService,
        validator: CollaborationsValidator,
      },
    },
    {
      plugin: _exports,
      options: {
        service: ProducerService,
        validator: ExportsValidator,
      },
    },
    {
      plugin: uploads,
      options: {
        service: storageService,
        validator: UploadsValidator,
      },
    },
  ]);

  server.ext('onPreResponse', (request, h) => {
    const { response } = request;
    if (response instanceof Error) {

      if (response instanceof NotFoundError) {
        const newResponse = h.response({
          status: 'fail',
          message: 'Data tidak ditemukan',
        });
        newResponse.code(response.statusCode);
        return newResponse;
      }

      if (response instanceof AuthorizationError) {
        const newResponse = h.response({
          status: 'fail',
          message: 'Anda tidak berhak mengakses resource ini',
        });
        newResponse.code(response.statusCode);
        return newResponse;
      }

      if (response instanceof ClientError) {
        const newResponse = h.response({
          status: 'fail',
          message: 'Gagal karena request tidak sesuai',
        });
        newResponse.code(response.statusCode);
        return newResponse;
      }

      if (response instanceof AuthenticationError) {
        const newResponse = h.response({
          status: 'fail',
          message: 'Anda dibatasi untuk mengakses resource ini',
        });
        newResponse.code(response.statusCode);
        return newResponse;
      }

      if (response instanceof ClientError) {
        const newResponse = h.response({
          status: 'fail',
          message: 'Gagal karena refresh token tidak valid',
        });
        newResponse.code(response.statusCode);
        return newResponse;
      }

      if (!response.isServer) {
        return h.continue;
      }
      
      const newResponse = h.response({
        status: 'error',
        message: 'terjadi kegagalan pada server kami',
      });

      console.log(response);
	    console.log(response.message);

      newResponse.code(500);
      return newResponse;
    }
    return h.continue;
  });
  
  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();