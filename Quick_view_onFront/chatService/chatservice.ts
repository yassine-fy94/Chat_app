import { Injectable } from '@angular/core';
import { ApiService } from '../ApiService/api-service';
import * as io from 'socket.io-client';
import { environment as env, environment } from 'src/environments/environment';
import { Observable } from 'rxjs/Observable';
import Swal from 'sweetalert2';

@Injectable({
    providedIn: 'root'
})

export class ChatService {
    private socket: any = null;
    response: boolean;

    constructor(private apiService: ApiService) {
        if(env.if_socket_io)
        {
            this.socket = io(env.BASE_URL_NODE);
        }
    }
    // pour Créer une conversation 
    CreateConversation(data: any) {
        return this.apiService.post(env.API_BASE_URL + 'Discussions/CreateConversation', data);
    }
    loadUsersAffectedToStructure(data, endPoint) {
        return this.apiService.post(env.API_BASE_URL + endPoint, data);
    }
    // Envoyer un message
    CreateMessage(data: any) {
        return this.apiService.postUpload(env.API_BASE_URL + 'Discussion_Message/CreateMessage', data);
    }
     // télecharger une piece jointe dans une conversation
     DownloadFileMessage(data: any) {
        return this.apiService.postDocument(env.API_BASE_URL + 'Discussion_Message/DownloadFileMessage', data);
    }
    // récupérer le discussions d'un utilisateur
    GetUserDiscussions(data: any) {
        return this.apiService.post(env.API_BASE_URL + 'Discussions/GetUserDiscussions', data);
    }

    sendMessage(data) {
        if (this.socket.connected==true) {
            setTimeout(() => {
                this.joinRoom({ user: data.user, room: data.room });
                setTimeout(() => {
                    this.socket.emit('message', data);
                    this.response = true;
                }, 10);
            }, 10);
        }
        else {

            this.response = false;
            this.error("sendMessage");
        }
        return this.response;
    }

    joinRoom(data) {
        if (this.socket.connected==true) {
            this.socket.emit('join', data);
        }
        else {
            this.error("joinRoom");
        }
    }

    leaveRoom(data) {
        if (this.socket.connected==true) {
            this.socket.emit('leave', data);
        }
        else {
            this.error("leaveRoom");
        }
    }

    newMessageReceivedHome() {
        if (this.socket.connected==true) {
            let observable = new Observable<{ user: String, message: String, room: String, if_socket_up:boolean,type_message:Number }>(observer => {
                this.socket.on('new message', (data) => {
                    observer.next(data);
                });
                return () => { this.socket.disconnect(); }
            });
            return observable;
        }
        else {
            this.error("newMessageReceived");
            return new Observable<{ user: String, message: String, room: String ,if_socket_up:boolean,type_message:Number}>();
        }
    }

    newMessageReceived() {
        let observable = new Observable<{ user: String, message: String, room: String, if_socket_up:boolean,type_message:Number }>(observer => {
            this.socket.on('new message', (data) => {
                observer.next(data);
            });
            return () => { this.socket.disconnect(); }
        });
        return observable;
    }

    error(message) {
        Swal.fire({
            icon: "warning",
            title: "La socket n\'est pas connéctée : "+ message,
            showConfirmButton: false,
            timer: 2000
        });
    }
}