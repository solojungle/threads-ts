import axios, { AxiosResponse } from "axios";

/**
 * Fields when trying to get profile information about a Threads user.
 */
type ProfileFields =
  | "id"
  | "username"
  | "name"
  | "threads_profile_picture_url"
  | "threads_biography";

type RetrieveRepliesFields =
  | "id"
  | "text"
  | "username"
  | "permalink"
  | "timestamp"
  | "media_product_type"
  | "media_type"
  | "media_url"
  | "shortcode"
  | "thumbnail_url"
  | "children"
  | "is_quote_post"
  | "has_replies"
  | "root_post"
  | "replied_to"
  | "is_reply"
  | "is_reply_owned_by_me"
  | "hide_status"
  | "reply_audience";

type Scope =
  | "threads_basic"
  | "threads_content_publish"
  | "threads_manage_insights"
  | "threads_manage_replies"
  | "threads_read_replies";

type ContainerStatus =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED";

type TimePeriod = "day" | "week" | "days_28" | "lifetime";

export interface ThreadsAPIConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /**
   * The scopes of access granted by the access_token expressed as a list of comma-delimited, or space-delimited, case-sensitive strings.
   */
  scope: Scope[];
}

/**
 * Note: Type CAROUSEL is not available for single thread posts.
 */
export type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
type ReplyControl = "everyone" | "accounts_you_follow" | "mentioned_only";

interface MediaContainer {
  id: string;
}

// Available metric names for both Media and User Insights
type MetricName =
  | "views"
  | "likes"
  | "replies"
  | "reposts"
  | "quotes"
  | "followers_count"
  | "follower_demographics";

// Structure for a single metric value (used in Media Insights)
interface MetricValue {
  value: number;
}

// Structure for a single time series value (used in User Insights)
interface TimeSeriesValue {
  value: number;
  end_time: string;
}

// Structure for a total value (used in User Insights)
interface TotalValue {
  value: number;
}

// Structure for a single metric in Media Insights
interface MediaMetric {
  name: MetricName;
  period: TimePeriod;
  values: MetricValue[];
  title: string;
  description: string;
  id: string;
}

// Structure for a single metric in User Insights
interface UserMetric {
  name: MetricName;
  period: TimePeriod;
  values?: TimeSeriesValue[];
  total_value?: TotalValue;
  title: string;
  description: string;
  id: string;
}

interface ContainerStatusResponse {
  status: ContainerStatus;
  id: string;
  error_message?: string;
}

// Main response structure for Media Insights
interface ThreadsMediaInsightsResponse {
  data: MediaMetric[];
}

// Main response structure for User Insights
interface ThreadsUserInsightsResponse {
  data: UserMetric[];
}

// Parameters for the User Insights API request
interface ThreadsUserInsightsParams {
  metric: MetricName | MetricName[];
  options: {
    since?: number; // Unix timestamp
    until?: number; // Unix timestamp
  };
}

interface TokenResponse {
  /**
   * A token that can be sent to a Threads API.
   */
  access_token: string;
  /**
   * Identifies the type of token returned. At this time, this field always has the value Bearer.
   */
  token_type: string;
  /**
   * The time in seconds at which this token is thought to expire.
   */
  expires_in: number;
}

export class ThreadsAPI {
  private config: ThreadsAPIConfig;

  private accessToken: string | null = null;

  private baseUrl = "https://graph.threads.net/v1.0/";

  constructor(config: ThreadsAPIConfig) {
    this.config = config;
  }

  /**
   * Set the access token for the API
   * @param accessToken The access token
   * @returns void
   */
  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  // Token Management
  async refreshTokenIfNeeded({
    accessToken,
    expiresIn,
  }: {
    accessToken: string;
    expiresIn: number;
  }): Promise<TokenResponse> {
    const currentTime = Math.floor(Date.now() / 1000);
    // If there is less than a week left on the token, refresh it
    if (currentTime >= expiresIn - 604800) {
      const response = await this.refreshLongLivedToken(accessToken);
      const { access_token: refreshedAccessToken } = response;
      this.accessToken = refreshedAccessToken;
      return response;
    }

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
    };
  }

  /**
   * Generate the authorization URL for OAuth flow
   * @param state Optional state parameter for OAuth
   * @returns The authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const baseUrl = "https://threads.net/oauth/authorize";
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(","),
      response_type: "code",
      ...(state && { state }),
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for a short-lived access token
   * @param code The authorization code
   * @returns Object containing short-lived access token and user ID
   */
  async getAccessToken(code: string): Promise<TokenResponse> {
    const url = `${this.baseUrl}oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
      code,
    });

    try {
      const response = await this.makeRequest<TokenResponse>({
        url,
        method: "POST",
        params,
      });
      this.accessToken = response.access_token;
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Exchange short-lived token for long-lived token
   * @param shortLivedToken The short-lived access token
   * @returns Object containing long-lived access token
   */
  async getLongLivedToken(shortLivedToken: string): Promise<TokenResponse> {
    const url = `${this.baseUrl}access_token`;
    const params = new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: this.config.clientSecret,
      access_token: shortLivedToken,
    });

    try {
      const response = await this.makeRequest<TokenResponse>({
        url,
        method: "GET",
        params,
      });
      return { ...response };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Refresh long-lived token
   * @param longLivedToken The long-lived access token to refresh
   * @returns The new long-lived access token
   */
  async refreshLongLivedToken(longLivedToken: string): Promise<TokenResponse> {
    const url = `${this.baseUrl}refresh_access_token`;
    const params = new URLSearchParams({
      grant_type: "th_refresh_token",
      access_token: longLivedToken,
    });

    try {
      const response = await this.makeRequest<TokenResponse>({
        url,
        method: "GET",
        params,
      });
      return { ...response };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a media container for a thread post
   * @param userId The user ID
   * @param mediaType The type of media
   * @param mediaUrl Optional URL for image or video
   * @param text Optional text content
   * @returns The creation ID of the media container
   */
  async createMediaContainer({
    userId,
    mediaType,
    mediaUrl,
    text,
  }: {
    userId: string;
    mediaType: MediaType;
    mediaUrl?: string;
    text?: string;
  }): Promise<string> {
    const url = `${this.baseUrl}${userId}/threads`;
    const params: Record<string, string> = {
      media_type: mediaType,
      ...(mediaType === "IMAGE" && mediaUrl && { image_url: mediaUrl }),
      ...(mediaType === "VIDEO" && mediaUrl && { video_url: mediaUrl }),
      ...(mediaType === "TEXT" && text && { text }),
    };

    try {
      const response = await this.makeRequest<MediaContainer>({
        url,
        method: "POST",
        params,
      });
      return response.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Publish a media container
   * @param userId The user ID
   * @param creationId The creation ID of the media container
   * @returns The ID of the published thread
   */
  async publishMediaContainer({
    userId,
    creationId,
  }: {
    userId: string;
    creationId: string;
  }): Promise<string> {
    const url = `${this.baseUrl}${userId}/threads_publish`;
    const params = new URLSearchParams({
      creation_id: creationId,
    });

    try {
      const response = await this.makeRequest<MediaContainer>({
        url,
        method: "POST",
        params,
      });
      return response.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Checks the status of a media container
   * @param containerId The ID of the media container
   * @returns The status of the media container
   * @note Recommended querying a container's status once per minute, for no more than 5 minutes.
   */
  async getMediaContainerStatus(
    containerId: string,
  ): Promise<ContainerStatusResponse> {
    const url = `${this.baseUrl}${containerId}`;
    const params = new URLSearchParams({
      fields: "status,error_message",
    });

    try {
      const response = await this.makeRequest<ContainerStatusResponse>({
        url,
        method: "GET",
        params,
      });

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a carousel item container
   * @param userId The user ID
   * @param mediaType The type of media (IMAGE or VIDEO)
   * @param mediaUrl The URL of the media
   * @returns The creation ID of the carousel item container
   */
  async createCarouselItemContainer({
    userId,
    mediaType,
    mediaUrl,
  }: {
    userId: string;
    mediaType: "IMAGE" | "VIDEO";
    mediaUrl: string;
  }): Promise<string> {
    const url = `${this.baseUrl}${userId}/threads`;
    const params: Record<string, string> = {
      media_type: mediaType,
      is_carousel_item: "true",
      ...(mediaType === "IMAGE"
        ? { image_url: mediaUrl }
        : { video_url: mediaUrl }),
    };

    try {
      const response = await this.makeRequest<MediaContainer>({
        url,
        method: "POST",
        params,
      });
      return response.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a carousel container
   * @param userId The user ID
   * @param children Array of creation IDs for carousel items
   * @param text Optional text content
   * @returns The creation ID of the carousel container
   */
  async createCarouselContainer({
    userId,
    children,
    text,
  }: {
    userId: string;
    children: string[];
    text?: string;
  }): Promise<string> {
    const url = `${this.baseUrl}${userId}/threads`;
    const params: Record<string, string> = {
      media_type: "CAROUSEL",
      children: children.join(","),
      ...(text && { text }),
    };

    try {
      const response = await this.makeRequest<MediaContainer>({
        url,
        method: "POST",
        params,
      });
      return response.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve user's threads
   * @param userId The user ID
   * @param fields Array of fields to retrieve
   * @param options Optional parameters for pagination and date range
   * @returns Array of user's threads
   */
  async getUserThreads({
    userId,
    fields,
    options,
  }: {
    userId: string;
    fields: string[];
    options?: { since?: string; until?: string; limit?: number };
  }): Promise<any[]> {
    const url = `${this.baseUrl}${userId}/threads`;
    const params: Record<string, string> = {
      fields: fields.join(","),
      ...(options?.limit && { limit: options.limit.toString() }),
      ...(options?.since && { since: options.since }),
      ...(options?.until && { until: options.until }),
    };

    try {
      const response = await this.makeRequest<{ data: any[] }>({
        url,
        method: "GET",
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve a single threads media object
   * @param mediaId The ID of the media object
   * @param fields Array of fields to retrieve
   * @returns The threads media object
   */
  async getThreadsMediaObject({
    mediaId,
    fields,
  }: {
    mediaId: string;
    fields: string[];
  }): Promise<any> {
    const url = `${this.baseUrl}${mediaId}`;
    const params = {
      fields: fields.join(","),
    };

    try {
      return await this.makeRequest({ url, method: "GET", params });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve a user's profile
   * @param userId The user ID
   * @param fields Array of fields to retrieve
   * @returns The user's profile
   */
  async getUserProfile({
    userId,
    fields,
  }: {
    userId: string;
    fields: ProfileFields[];
  }): Promise<any> {
    const url = `${this.baseUrl}${userId}`;
    const params = {
      fields: fields.join(","),
    };

    try {
      return await this.makeRequest({ url, method: "GET", params });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve replies to a thread
   * @param mediaId The ID of the thread
   * @param fields Array of fields to retrieve
   * @param reverse Whether to reverse the order of replies
   * @returns Array of replies
   */
  async getReplies({
    mediaId,
    fields,
    reverse = true,
  }: {
    mediaId: string;
    fields: RetrieveRepliesFields[];
    reverse?: boolean;
  }): Promise<any[]> {
    const url = `${this.baseUrl}${mediaId}/replies`;
    const params = {
      fields: fields.join(","),
      reverse: reverse.toString(),
    };

    try {
      const response = await this.makeRequest<{ data: any[] }>({
        url,
        method: "GET",
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve a conversation thread
   * @param mediaId The ID of the thread
   * @param fields Array of fields to retrieve
   * @param reverse Whether to reverse the order of conversation
   * @returns Array of conversation items
   */
  async getConversation({
    mediaId,
    fields,
    reverse = true,
  }: {
    mediaId: string;
    fields: string[];
    reverse?: boolean;
  }): Promise<any[]> {
    const url = `${this.baseUrl}${mediaId}/conversation`;
    const params = {
      fields: fields.join(","),
      reverse: reverse.toString(),
    };

    try {
      const response = await this.makeRequest<{ data: any[] }>({
        url,
        method: "GET",
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Hide or unhide a reply
   * @param replyId The ID of the reply
   * @param hide Whether to hide (true) or unhide (false) the reply
   * @returns Whether the operation was successful
   */
  async hideReply({
    replyId,
    hide,
  }: {
    replyId: string;
    hide: boolean;
  }): Promise<boolean> {
    const url = `${this.baseUrl}${replyId}/manage_reply`;
    const params = new URLSearchParams({
      hide: hide.toString(),
    });

    try {
      const response = await this.makeRequest<{ success: boolean }>({
        url,
        method: "POST",
        params,
      });
      return response.success;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Respond to a reply
   * @param userId The user ID
   * @param mediaType The type of media for the response
   * @param text The text content of the response
   * @param replyToId The ID of the thread to reply to
   * @returns The ID of the created reply
   */
  async respondToReply({
    userId,
    mediaType,
    text,
    replyToId,
  }: {
    userId: string;
    mediaType: MediaType;
    text: string;
    replyToId: string;
  }): Promise<string> {
    const url = `${this.baseUrl}${userId}/threads`;
    const params = {
      media_type: mediaType,
      text,
      reply_to_id: replyToId,
    };

    try {
      const response = await this.makeRequest<MediaContainer>({
        url,
        method: "POST",
        params,
      });
      return response.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Control who can reply to a thread
   * @param userId The user ID
   * @param mediaType The type of media for the thread
   * @param text The text content of the thread
   * @param replyControl The reply control setting
   * @returns The ID of the created thread
   */
  async controlWhoCanReply({
    userId,
    mediaType,
    text,
    replyControl,
  }: {
    userId: string;
    mediaType: MediaType;
    text: string;
    replyControl: ReplyControl;
  }): Promise<string> {
    const url = `${this.baseUrl}${userId}/threads`;
    const params = {
      media_type: mediaType,
      text,
      reply_control: replyControl,
    };

    try {
      const response = await this.makeRequest<MediaContainer>({
        url,
        method: "POST",
        params,
      });
      return response.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve media insights
   * @param mediaId The ID of the media
   * @param metrics Array of metrics to retrieve
   * @returns The media insights
   */
  async getMediaInsights({
    mediaId,
    metrics,
  }: {
    mediaId: string;
    metrics: string[];
  }): Promise<ThreadsMediaInsightsResponse> {
    const url = `${this.baseUrl}${mediaId}/insights`;
    const params = {
      metric: metrics.join(","),
    };

    try {
      const response = await this.makeRequest<{
        data: ThreadsMediaInsightsResponse;
      }>({
        url,
        method: "GET",
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieve user insights
   * @param userId The user ID
   * @param metrics Array of metrics to retrieve
   * @param options Optional parameters for date range
   * @returns The user insights
   */
  async getUserInsights({
    userId,
    metric,
    options,
  }: {
    userId: string;
  } & ThreadsUserInsightsParams): Promise<ThreadsUserInsightsResponse> {
    const url = `${this.baseUrl}${userId}/threads_insights`;
    const params: Record<string, string> = {
      metric: Array.isArray(metric) ? metric.join(",") : metric,
      ...(options?.since && { since: options.since.toString() }),
      ...(options?.until && { until: options.until.toString() }),
    };

    try {
      const response = await this.makeRequest<{
        data: ThreadsUserInsightsResponse;
      }>({
        url,
        method: "GET",
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a request to the Threads API
   * @param url The API endpoint URL
   * @param method The HTTP method
   * @param params The request parameters
   * @returns The response data
   */
  private async makeRequest<T>({
    url,
    method,
    params,
  }: {
    url: string;
    method: "GET" | "POST";
    params: Record<string, string> | URLSearchParams;
  }): Promise<T> {
    const config = {
      method,
      url,
      ...(method === "GET" ? { params } : { data: params }),
      headers: {
        ...(this.accessToken && {
          Authorization: `Bearer ${this.accessToken}`,
        }),
      },
    };

    try {
      const response: AxiosResponse<T> = await axios(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle errors from API requests
   * @param error The error object
   * @returns The error message
   */
  // eslint-disable-next-line class-methods-use-this
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(error.response.data.error_message || error.message);
      }
      throw new Error(error.message);
    }
    throw error;
  }
}
