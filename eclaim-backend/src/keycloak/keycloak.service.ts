import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AxiosResponse } from 'axios';
import { lastValueFrom } from 'rxjs';
import { AllConfigType } from 'src/config/config.type';

@Injectable()
export class KeycloakService {
  private readonly realm = this.configService.get('keycloak.realm', {
    infer: true,
  });
  private readonly clientId = this.configService.get('keycloak.client_id', {
    infer: true,
  });
  private readonly clientSecret = this.configService.get(
    'keycloak.client_secret',
    {
      infer: true,
    },
  );
  private readonly scope = this.configService.get('keycloak.client_scope', {
    infer: true,
  });
  private readonly baseUrl = this.configService.get('keycloak.keycloak_url', {
    infer: true,
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async getAdminToken() {
    try {
      const response: AxiosResponse = await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials',
            scope: 'openid profile email', // Add this line
          }),
        ),
      );

      return response.data.access_token;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to authenticate',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private generateUserFromEmail(email: string) {
    const [localPart] = email.split('@');

    // Split local part by dots, underscores, or hyphens
    const parts = localPart.split(/[\._\-]/);

    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

    const lastName = parts[1]
      ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
      : 'User';

    // Username is the email itself
    const username = email.toLowerCase();

    return { username, firstName, lastName };
  }

  async createUser(token: string, email: string): Promise<any> {
    const url = `${this.baseUrl}/admin/realms/${this.realm}/users`;
    const { username, firstName, lastName } = this.generateUserFromEmail(email);

    const data = { username, email, firstName, lastName, enabled: true };

    try {
      const response: AxiosResponse = await lastValueFrom(
        this.httpService.post(url, data, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      const location = response.headers['location'];
      if (!location) {
        throw new HttpException(
          'Keycloak did not return user location',
          HttpStatus.BAD_REQUEST,
        );
      }
      const userId = location.split('/').pop();

      // await this.sendVerificationEmail(userId);

      return {
        status: response.status,
        message: 'User created successfully and verification email sent',
        username,
        userId,
      };
    } catch (error: any) {
      const status =
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;

      const errorData = error?.response?.data;

      let message = 'User creation failed';

      if (typeof errorData === 'string') {
        message = errorData;
      } else if (errorData?.errorMessage) {
        message = errorData.errorMessage;
      } else if (errorData?.error) {
        message = errorData.error;
      } else if (error?.message) {
        message = error.message;
      }
      throw new HttpException(message, status);
    }
  }

  async updatePassword(userId: string): Promise<any> {
    const adminToken = await this.getAdminToken();

    const data = {
      value: '12345678',
    };

    try {
      const response: AxiosResponse = await lastValueFrom(
        this.httpService.put(
          `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/reset-password`,
          data,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      return response;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to update password',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getUsers(email: string): Promise<any> {
    try {
      const adminToken = await this.getAdminToken();
      const response: AxiosResponse = await lastValueFrom(
        this.httpService.get(
          `${this.baseUrl}/admin/realms/${this.realm}/users?email=${email}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          },
        ),
      );
      return response?.data[0];
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to fetch users',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getUserCount(): Promise<number> {
    const adminToken = await this.getAdminToken();

    const response: AxiosResponse = await lastValueFrom(
      this.httpService.get(
        `${this.baseUrl}/admin/realms/${this.realm}/users/count`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      ),
    );

    return response.data;
  }

  async getAllUsers(offset: number = 0, max: number = 10): Promise<any> {
    try {
      const adminToken = await this.getAdminToken();

      // Step 1: Get users
      const usersResponse: AxiosResponse = await lastValueFrom(
        this.httpService.get(
          `${this.baseUrl}/admin/realms/${this.realm}/users`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
            params: { first: offset, max: max },
          },
        ),
      );

      const users = usersResponse.data;

      // Step 2: For each user, get their realm roles
      const usersWithRoles = await Promise.all(
        users.map(async (user: any) => {
          const rolesResponse: AxiosResponse = await lastValueFrom(
            this.httpService.get(
              `${this.baseUrl}/admin/realms/${this.realm}/users/${user.id}/role-mappings/realm`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            ),
          );

          return {
            ...user,
            roles: rolesResponse.data.map((role: any) => role.name),
          };
        }),
      );

      return usersWithRoles;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to fetch users with roles',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`;
      const response: AxiosResponse = await lastValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return response.data; // Return the user information
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to fetch user info',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async sendVerificationEmail(userId: string): Promise<any> {
    const adminToken = await this.getAdminToken();
    console.log('Sending verification email to user ID:', userId);

    try {
      await lastValueFrom(
        this.httpService.put(
          `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/send-verify-email?client_id=${this.clientId}&redirect_uri=ddsc://verified`,
          {},
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      );
      // Keycloak does not return a response body for this endpoint, so we assume success if no error is thrown
      return {
        success: true,
        message: 'Verification email sent successfully',
      };
    } catch (error) {
      console.log(error, 'Keycloak send verification email error');
      throw new HttpException(
        error.response?.data || 'Failed to send verification email',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
